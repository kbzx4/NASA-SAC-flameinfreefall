"""Fit predictive models to NASA's droplet (FLEX) and gas-flame (CFI-G) tests, for the site's Fire model.

Droplets (FLEX, PSI-69), one row per test:
  ending:  multinomial logistic regression over how each test ended: flame went out on its own (E),
           burned until the fuel was used up (C), or droplet disrupted (D).
  rate:    linear regression of log burning rate (mm^2/s, the d2-law constant) on the same inputs.
  inputs:  oxygen %, CO2 %, helium %, pressure (atm), starting diameter (mm), fuel (heptane or methanol).
Gas flames (CFI-G, PSI-159):
  lights:  logistic regression, did the flame light (hot ignition)?
  self_ext: logistic regression, for flames that lit, did it go out on its own (vs burned until the
           fuel was cut off)?
  inputs:  oxygen %, pressure (bar), fuel mole fraction, fuel flow (mg/s), fuel (ethane, propane, butane).

Every model is scored by 5-fold cross-validation (each test is predicted by a model that never saw
it), and refit on 300 bootstrap resamples of the tests. The site evaluates all 300 and reports the
middle 90% as the uncertainty range. Inputs are standardised; the means and scales are exported.

Run from the project root:  python scripts/build_models.py
"""
import json
import sys
import warnings
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.linear_model import LinearRegression, LogisticRegression
from sklearn.metrics import accuracy_score, mean_absolute_error, r2_score, roc_auc_score
from sklearn.model_selection import KFold, StratifiedKFold, cross_val_predict

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
from scripts.build_catalog import read  # noqa: E402

warnings.filterwarnings("ignore")
OUT = ROOT / "data" / "models.json"
BOOT = 300
RNG = np.random.default_rng(7)


def flex():
    f = pd.DataFrame(read("PSI-69_Experimental table_FLEX.csv"))
    n = lambda c: pd.to_numeric(f[c], errors="coerce")
    d = pd.DataFrame({
        "o2": n("O initial ambient composition; mole fraction") * 100,
        "co2": n("CO initial ambient composition; mole fraction") * 100,
        "he": n("He initial ambient composition; mole fraction") * 100,
        "p": n("Ambient pressure; mmHg") / 760,
        "d0": n("Droplet initial diameter; mm"),
        "hep": (f["Fuel"] == "Heptane").astype(float),
        "K": n("Burning rate; mm"), "tb": n("Burn time; s"), "dx": n("Visible flame extinction diameter; mm"),
        "end": f["Test end"].map({"Extinction": "E", "Completion": "C", "Disruption": "D"}),
        "id": f["FLEX Identifier"],
    })
    return d[(d.p > 0.3)].dropna(subset=["o2", "p", "d0", "end"]).reset_index(drop=True)


def cfig():
    g = pd.DataFrame(read("PSI-159_Experimental table_CFI-G_Normal Flames.csv"))
    n = lambda c: pd.to_numeric(g[c], errors="coerce")
    fuel = g["Fuel"].str.replace(r"^\d+% ", "", regex=True)
    d = pd.DataFrame({
        "o2": n("XO2 before test") * 100, "p": n("approx p (bar)"), "xf": n("Xf"), "m": n("mHC (mg/s)"),
        "propane": (fuel == "propane").astype(float), "butane": (fuel == "butane").astype(float),
        "lit": (g["Hot ignition"] == "Yes").astype(int), "se": (g["Self-ext or flow term"] == "SE").astype(int),
        "tb": n("burn time (sec)"), "fuel": fuel, "id": g["Test"],
    })
    return d.dropna(subset=["o2", "p", "xf", "m"]).reset_index(drop=True)


def scaler(X):
    mu, sd = X.mean(0), X.std(0)
    sd[sd == 0] = 1
    return mu, sd


def logistic(X, y, classes, cv_folds=5):
    """Fit, cross-validate and bootstrap a (multinomial) logistic regression on standardised X."""
    mu, sd = scaler(X)
    Z = (X - mu) / sd
    model = lambda: LogisticRegression(C=1.0, max_iter=5000)
    p = cross_val_predict(model(), Z, y, cv=StratifiedKFold(cv_folds, shuffle=True, random_state=0), method="predict_proba")
    labels = sorted(set(y))
    score = {"tests": int(len(y)), "accuracy": round(float(accuracy_score(y, np.array(labels)[p.argmax(1)])), 3),
             "majority_guess": round(float(pd.Series(y).value_counts(normalize=True).max()), 3)}
    if len(labels) == 2:
        score["auc"] = round(float(roc_auc_score(y, p[:, 1])), 3)
    else:
        first = labels.index(classes[0])
        score["auc_first_class"] = round(float(roc_auc_score(np.array(y) == classes[0], p[:, first])), 3)
    boots = []
    while len(boots) < BOOT:
        i = RNG.integers(0, len(y), len(y))
        if len(set(np.array(y)[i])) < len(labels):
            continue
        m = model().fit(Z[i], np.array(y)[i])
        boots.append(pack(m, labels, classes))
    full = pack(model().fit(Z, y), labels, classes)
    return {"mu": mu.round(5).tolist(), "sd": sd.round(5).tolist(), "classes": classes, "fit": full, "boot": boots, "score": score}


def pack(m, labels, classes):
    """Coefficients as [[intercept, w1, w2, ...] per class], in the order of `classes`. Binary: one row."""
    if len(labels) == 2:
        return [[round(float(m.intercept_[0]), 4)] + [round(float(w), 4) for w in m.coef_[0]]]
    rows = {lab: [float(m.intercept_[k])] + list(map(float, m.coef_[k])) for k, lab in enumerate(m.classes_)}
    return [[round(v, 4) for v in rows[c]] for c in classes]


def linear(X, y):
    mu, sd = scaler(X)
    Z = (X - mu) / sd
    p = cross_val_predict(LinearRegression(), Z, y, cv=KFold(5, shuffle=True, random_state=0))
    full = LinearRegression().fit(Z, y)
    resid = float(np.std(y - full.predict(Z)))
    boots = []
    for _ in range(BOOT):
        i = RNG.integers(0, len(y), len(y))
        m = LinearRegression().fit(Z[i], y[i])
        boots.append([round(float(m.intercept_), 4)] + [round(float(w), 4) for w in m.coef_])
    return {"mu": mu.round(5).tolist(), "sd": sd.round(5).tolist(),
            "fit": [round(float(full.intercept_), 4)] + [round(float(w), 4) for w in full.coef_],
            "boot": boots, "resid_sd": round(resid, 4),
            "score": {"tests": int(len(y)), "r2_log": round(float(r2_score(y, p)), 3),
                      "mae": round(float(mean_absolute_error(np.exp(y), np.exp(p))), 3)}}


def odds(model, names):
    """Plain-language effect of each input in the full fit: the odds multiplier per unit."""
    w = model["fit"][0][1:]
    return {n: round(float(np.exp(wi / s)), 3) for n, wi, s in zip(names, w, model["sd"])}


def main():
    d = flex()
    xs = ["o2", "co2", "he", "p", "d0", "hep"]
    X = d[xs].to_numpy(float)
    ending = logistic(X, d["end"].tolist(), ["E", "C", "D"])
    ext = logistic(X, (d["end"] == "E").astype(int).tolist(), [0, 1])
    ending["odds_flame_goes_out"] = odds(ext, xs)
    ending["score"]["auc_goes_out"] = ext["score"]["auc"]
    k = d.dropna(subset=["K"])
    k = k[k.K > 0]
    rate = linear(k[xs].to_numpy(float), np.log(k["K"].to_numpy(float)))
    ext_ratio = (d.dx / d.d0)[(d.end == "E") & d.dx.notna() & (d.dx < d.d0)]

    g = cfig()
    gs = ["o2", "p", "xf", "m", "propane", "butane"]
    lights = logistic(g[gs].to_numpy(float), g["lit"].tolist(), [0, 1])
    lit = g[g.lit == 1]
    self_ext = logistic(lit[gs].to_numpy(float), lit["se"].tolist(), [0, 1])
    self_ext["odds_goes_out"] = odds(self_ext, gs)
    se_t = lit[lit.se == 1].tb.dropna()

    out = {
        "droplets": {
            "inputs": xs, "ending": ending, "rate": rate,
            "range": {c: [round(float(d[c].min()), 2), round(float(d[c].max()), 2)] for c in xs},
            # how much of the droplet is left when a flame goes out, as a share of its start diameter
            "ext_ratio": [round(float(q), 3) for q in np.quantile(ext_ratio, np.linspace(0.05, 0.95, 19))],
            "sizes": [round(float(q), 2) for q in np.quantile(d.d0, np.linspace(0.05, 0.95, 19))],
            "points": [[round(float(r.o2), 1), r.end, int(r.hep), round(float(r.d0), 2), round(float(r.co2 + r.he), 1)] for r in d.itertuples()],
        },
        "gas": {
            "inputs": gs, "lights": lights, "self_ext": self_ext,
            "range": {c: [round(float(g[c].min()), 3), round(float(g[c].max()), 3)] for c in gs},
            "burn_s": [round(float(q), 1) for q in np.quantile(se_t, np.linspace(0.05, 0.95, 19))],
            "points": [[round(float(r.o2), 1), int(r.lit), int(r.se), r.fuel] for r in g.itertuples()],
        },
    }
    # predictions from the full fits for a few inputs; tests/parity.mjs checks the site gets the same
    def probs(model, x):
        z = (np.array(x, float) - np.array(model["mu"])) / np.array(model["sd"])
        logits = np.array([r[0] + np.dot(r[1:], z) for r in model["fit"]])
        if len(logits) == 1:
            return [round(float(1 / (1 + np.exp(-logits[0]))), 4)]
        e = np.exp(logits - logits.max())
        return [round(float(v), 4) for v in e / e.sum()]
    cases = [[21, 0, 0, 1, 3, 0], [30, 0, 0, 0.7, 2.5, 1], [34, 20, 0, 1, 4, 0], [15, 0, 30, 1, 2, 1]]
    out["checks"] = {
        "ending": [[x, probs(ending, x)] for x in cases],
        "rate": [[x, round(float(np.exp(rate["fit"][0] + np.dot(rate["fit"][1:], (np.array(x) - rate["mu"]) / rate["sd"]))), 4)] for x in cases],
        "self_ext": [[x, probs(self_ext, x)] for x in [[21, 1.01, 1, 1, 1, 0], [39, 2.03, 0.3, 1.5, 0, 1]]],
    }
    OUT.write_text(json.dumps(out, separators=(",", ":")), encoding="utf-8")
    print(f"models.json {OUT.stat().st_size / 1024:.0f} KB")
    print("droplet ending", ending["score"], "\n  odds per unit:", ending["odds_flame_goes_out"])
    print("droplet rate", rate["score"], "resid sd", rate["resid_sd"])
    print("gas lights", lights["score"])
    print("gas self-ext", self_ext["score"], "\n  odds per unit:", self_ext["odds_goes_out"])


if __name__ == "__main__":
    main()
