import json

import pandas as pd
import plotly.graph_objects as go
import streamlit as st

import brief
import core
import si

st.set_page_config(page_title="Fire Evidence Brief", page_icon="🔥", layout="wide")

BLUE, ORANGE, AQUA, GRAY = "#2a78d6", "#eb6834", "#1baf7a", "#8a8a85"
CLASS_COLOR = {"solid": BLUE, "liquid": ORANGE, "gas": AQUA}
DEFAULT_MATERIALS = ["PMMA (acrylic)", "Silicone", "Cotton-fiberglass fabric (SIBAL)", "Nomex", "Kapton", "Teflon"]


@st.cache_data
def data():
    return core.load_catalog(), core.load_pairs()


@st.cache_data(show_spinner=False)
def interpret(facts_json):
    return si.interpret(json.loads(facts_json))


cat, pairs = data()

# ------------------------------------------------------------------ sidebar
with st.sidebar:
    st.header("1. Your habitat")
    name = st.selectbox("Scenario", list(core.SCENARIOS), index=1)
    preset = core.SCENARIOS[name]
    st.caption(preset["note"])
    custom = name == "Custom"
    o2 = st.slider("Oxygen (% by volume)", 10.0, 100.0, preset["o2"], 0.5, disabled=not custom)
    pressure = st.slider("Pressure (psi)", 3.0, 45.0, preset["pressure"], 0.1, disabled=not custom)
    flow = st.slider("Ventilation airflow (cm/s)", 0.0, 40.0, 10.0, 1.0,
                     help="Set this to your habitat's air speed. The default of 10 cm/s is a placeholder, not a NASA value.")
    gravity_label = st.selectbox("Gravity", list(core.GRAVITY), index=1)
    partial = core.GRAVITY[gravity_label] != "ug"
    st.header("2. Materials on board")
    all_materials = brief.materials(cat)
    chosen = st.multiselect("Materials", all_materials,
                            default=[m for m in DEFAULT_MATERIALS if m in all_materials])
    st.caption("These are the materials named in the loaded NASA tables.")

facts = brief.build_facts(cat, pairs, name, o2, pressure, flow, gravity_label, chosen)

# ------------------------------------------------------------------- header
st.title("Fire Evidence Brief")
st.markdown("**Describe a crewed habitat. Get what NASA's microgravity fire experiments say about it, "
            "and how far those tests are from your conditions.**")
st.warning("An evidence summary, not a safety assessment. It reports which NASA tests exist near your "
           "conditions. It does not predict whether a material will burn.", icon="⚠️")

tab_brief, tab_bound, tab_rank, tab_cover, tab_compare, tab_about = st.tabs(
    ["Your brief", "Gravity bound", "Ranked investigations", "Oxygen coverage", "Compare", "Data, limits and sources"])

# -------------------------------------------------------------------- brief
with tab_brief:
    if not chosen:
        st.info("Pick at least one material in the sidebar.")
    else:
        st.subheader(brief.headline(facts))
        st.markdown(f"**{name}**: {o2:g}% oxygen, {pressure:g} psi, {flow:g} cm/s airflow, {gravity_label}.")
        if partial:
            st.info(f"**{gravity_label}: no test data.** No loaded investigation ran in partial gravity. "
                    "The Gravity column compares microgravity with normal gravity for the same material. "
                    "NASA's challenge statement says the two could bound what happens in between.", icon="🌙")

        rows = []
        for m in facts["materials"]:
            g = [p["gsi"] for p in m["gravity_pairs"]]
            rows.append({
                "Material": m["material"],
                "Evidence": brief.GRADES[m["grade"]],
                "Flame tests": m["flame_tests"],
                "Oxygen tested (%)": m["oxygen_tested_pct"] or "not listed",
                "Gap to your oxygen (points)": m["oxygen_gap_points"],
                "Gravity (GSI)": (f"{min(g):.2f}" if min(g) == max(g) else f"{min(g):.2f} to {max(g):.2f}") if g else "no 1g pair",
                "Smoke tests": m["smoke_tests"],
            })
        st.dataframe(pd.DataFrame(rows), hide_index=True, width="stretch",
                     column_config={"Gap to your oxygen (points)": st.column_config.NumberColumn(format="%.1f")})
        st.caption(f"\"Near\" means within {brief.NEAR:g} points of oxygen. No solid-fuel table loaded here lists "
                   "pressure, so the grade uses oxygen only. GSI: 0 means microgravity and 1g gave the same "
                   "burn length; 1 means the sample burned fully in one and not at all in the other.")

        # oxygen tested per material
        ev_rows = brief.evidence_rows(cat, chosen)
        flame = ev_rows[(ev_rows["fuel_class"] == "solid") & (ev_rows["gravity"] != "1g") & ev_rows["o2_pct"].notna()]
        fig = go.Figure()
        xs, ys, ids = [], [], []
        for m in chosen:
            mine = flame[flame["material"].map(lambda cell: m in cell.split("; "))]
            xs += list(mine["o2_pct"])
            ys += [m] * len(mine)
            ids += list(mine["investigation"] + " test " + mine["test_id"].astype(str))
        fig.add_trace(go.Scatter(
            x=xs, y=ys, mode="markers", customdata=ids, showlegend=False,
            hovertemplate="<b>%{y}</b><br>%{customdata}<br>O2 %{x:g}%<extra></extra>",
            marker=dict(color=BLUE, size=14, symbol="line-ns-open", line=dict(width=2))))
        fig.add_vline(x=o2, line=dict(color=ORANGE, dash="dash", width=2),
                      annotation_text=f"Your habitat: {o2:g}% O2", annotation_position="top")
        fig.update_layout(
            title="Oxygen level of each microgravity flame test, by material",
            height=110 + 44 * len(chosen), margin=dict(l=10, r=10, t=70, b=40),
            xaxis=dict(title="Oxygen (% by volume)", range=[10, max(40, o2 + 5)]),
            yaxis=dict(title=None, categoryorder="array", categoryarray=chosen[::-1], range=[-0.5, len(chosen) - 0.5]))
        st.plotly_chart(fig, width="stretch")

        st.markdown("#### By material")
        for m in facts["materials"]:
            with st.expander(f"{m['material']}: {brief.GRADES[m['grade']]}"):
                for s in brief.material_sentences(m, o2, partial):
                    st.markdown(f"- {s}")
                if m["gravity_pairs"]:
                    st.dataframe(pd.DataFrame(m["gravity_pairs"]).rename(columns={
                        "sample": "Saffire-II sample", "thickness": "Thickness", "gsi": "GSI",
                        "microgravity_burn_length": "Microgravity burn length (source)",
                        "normal_gravity_burn_length": "1g burn length (source)"}),
                        hide_index=True, width="stretch")

        st.markdown("#### Your atmosphere: liquids and gases")
        cols = st.columns(2)
        for col, (title, text) in zip(cols, brief.atmosphere_sentences(facts["atmosphere"], o2).items()):
            col.markdown(f"**{title}**")
            col.markdown(text)
        st.caption("These counts are descriptive. Fuel, pressure and flow rate vary between tests along with oxygen.")

        st.markdown("#### Interpretation")
        facts_json = json.dumps(facts, sort_keys=True)
        if st.button("Write the interpretation with SI", type="primary"):
            with st.spinner("Writing, then checking every number against the data"):
                st.session_state["si"] = (facts_json, interpret(facts_json))
        result = None
        if st.session_state.get("si", (None,))[0] == facts_json:
            result = st.session_state["si"][1]
            if "error" in result:
                st.error(f"{result['error']} The brief above does not depend on it.")
                result = None
            else:
                st.markdown(result["text"])
                note = f"✅ {result['verified']} of {result['total']} numbers match the data above."
                if result["dropped"]:
                    note += f" {result['dropped']} sentences were removed because a number did not match."
                st.caption(f"{note} Written by {result['model']}; checked by code, not by the model.")
        else:
            st.caption("SI writes one paragraph from the facts above. Code then checks every number in it "
                       "against those facts and removes any sentence that fails.")

        d1, d2 = st.columns(2)
        d1.download_button("Download the brief (HTML, printable)", brief.brief_html(facts, result),
                           file_name="fire-evidence-brief.html", mime="text/html")
        d2.download_button(f"Download the {len(ev_rows)} test records behind it (CSV)",
                           ev_rows.to_csv(index=False), file_name="fire-evidence-records.csv", mime="text/csv")

# ------------------------------------------------------------ gravity bound
with tab_bound:
    paired = pairs.dropna(subset=["gsi"]).sort_values("gsi")
    flips = paired[paired["gsi"] >= 0.5]
    tight = paired[paired["gsi"] == 0]
    st.subheader(f"Gravity changed the outcome for {len(flips)} of {len(paired)} Saffire-II samples")
    st.markdown(
        f"Saffire-II burned the same materials in microgravity and in normal gravity. For {len(tight)} "
        f"samples the burn length was the same in both, so the answer for the Moon or Mars is "
        f"constrained. For {len(flips)} samples it differed by half the sample or more, so the "
        "answer in partial gravity is open."
    )

    fig = go.Figure()
    for r in paired.itertuples():
        fig.add_trace(go.Scatter(
            x=[r.ug, r.g1], y=[r.label, r.label], mode="lines",
            line=dict(color=GRAY, width=8), opacity=0.35, hoverinfo="skip", showlegend=False))
    hover = ("<b>%{y}</b><br>%{meta}: %{customdata[0]}<br>Spread: %{customdata[1]}"
             "<br>Plotted as %{x:g} cm<extra></extra>")
    fig.add_trace(go.Scatter(
        x=paired["ug"], y=paired["label"], mode="markers", name="Microgravity",
        meta="Microgravity burn length (source text)",
        customdata=paired[["ug_raw", "ug_spread"]].fillna("not listed"), hovertemplate=hover,
        marker=dict(color=BLUE, size=14, symbol="circle", line=dict(color="white", width=2))))
    fig.add_trace(go.Scatter(
        x=paired["g1"], y=paired["label"], mode="markers", name="Normal gravity (1g)",
        meta="1g burn length (source text)",
        customdata=paired[["g1_raw", "g1_spread"]].fillna("not listed"), hovertemplate=hover,
        marker=dict(color=ORANGE, size=14, symbol="diamond", line=dict(color="white", width=2))))
    for r in paired.itertuples():
        fig.add_annotation(x=1.0, xref="paper", xanchor="left", y=r.label, showarrow=False,
                           text=f"  GSI {r.gsi:.2f}", font=dict(size=13))
    fig.update_layout(
        height=60 + 46 * len(paired), margin=dict(l=10, r=90, t=40, b=40),
        legend=dict(orientation="h", y=1.08, x=0),
        xaxis=dict(title="Burn length (cm)", rangemode="tozero", zeroline=False),
        yaxis=dict(title=None),
    )
    st.plotly_chart(fig, width="stretch")
    st.caption("Grey bar: the range between the microgravity and 1g result. If burn length changes "
               "steadily with gravity, the Moon and Mars fall inside it. Hover a marker for the source text.")

    a, b = st.columns(2)
    with a:
        st.markdown("**Gravity Sensitivity Index**")
        st.latex(r"\mathrm{GSI} = \frac{|L_{1g} - L_{\mu g}|}{L_{\mathrm{sample}}}")
        st.markdown(
            "L is burn length. **0** means microgravity and 1g agree, so the bound is tight. "
            "**1** means the sample burned fully in one and not at all in the other, so the bound "
            "says nothing about partial gravity."
        )
    with b:
        st.markdown("**Read this before you use it**")
        st.markdown(
            "- NASA's challenge statement says microgravity and normal-gravity results *could* bound "
            "intermediate gravity. That is a hypothesis. It assumes behaviour changes steadily with gravity.\n"
            f"- {len(paired)} samples, one oxygen level (about 22%), one airflow (20 cm/s).\n"
            "- The PSI table does not state the oxygen, pressure or airflow of the 1g tests.\n"
            "- GSI uses burn length only. The fabric samples have GSI 0 but spread at a steady "
            "2.1 to 2.6 mm/s in microgravity and accelerated in 1g.\n"
            "- For thick PMMA the microgravity value is the length with visible damage after a "
            "600 to 900 s burn, with the flame still anchored (source notes 3 and 4)."
        )
    with st.expander("Table view and source text"):
        show = pairs[["sample", "material", "thickness", "direction", "o2_raw", "flow_raw",
                      "ug_raw", "ug_spread", "g1_raw", "g1_spread", "ug", "g1", "full", "gsi"]].copy()
        show.columns = ["Sample", "Material", "Thickness", "Flow direction", "O2 % (source)",
                        "Airflow (source)", "µg burn length (source)", "µg spread (source)",
                        "1g burn length (source)", "1g spread (source)", "µg plotted (cm)",
                        "1g plotted (cm)", "Sample length (cm)", "GSI"]
        st.dataframe(show, hide_index=True, width="stretch")
        st.caption("Source: PSI-99 experiment table, Saffire-II. \"Complete\" is plotted as the full "
                   "sample length. Sample 2-7 is split into its PMMA and Nomex sections; the table "
                   "gives no 1g result for the PMMA section, so it has no GSI.")

# ----------------------------------------------------------- ranked evidence
with tab_rank:
    fuel_label = st.selectbox("What are you worried about?", list(core.FUEL_CLASSES))
    fuel_class = core.FUEL_CLASSES[fuel_label]
    scored = core.score_tests(cat, o2, pressure, flow, fuel_class)
    ranking = core.rank_investigations(scored, o2, pressure, flow, fuel_class)
    top = ranking.iloc[0]
    st.subheader(f"Most relevant investigation for {name}: {top['Investigation']}")
    if top["HFRI"] < 0.4:
        st.error("No close evidence. Nothing loaded here was tested near this scenario. Treat it as a research gap.", icon="🕳️")
    st.markdown(f"Scenario: **{o2:g}% O2, {pressure:g} psi, {flow:g} cm/s airflow**, "
                f"concern: **{fuel_label.lower()}**.")
    st.dataframe(
        ranking, hide_index=True, width="stretch",
        column_config={
            "HFRI": st.column_config.ProgressColumn("HFRI", min_value=0, max_value=1, format="%.2f"),
            "Why": st.column_config.TextColumn("Why", width="large"),
            "Source": st.column_config.LinkColumn("Source", display_text="Open record"),
        })
    a, b = st.columns(2)
    with a:
        st.markdown("**Habitat Fire Relevance Index**")
        st.latex(r"\mathrm{HFRI} = M_{\mathrm{conditions}} \times M_{\mathrm{fuel}} \times W_{\mathrm{evidence}}")
        st.markdown(
            "An investigation's HFRI is that of its closest test. It measures how close the "
            "evidence is to your scenario. It says nothing about whether the material burns."
        )
    with b:
        st.markdown(
            f"- **M_conditions**: mean closeness of oxygen, pressure and airflow. Each is 1 inside "
            f"the tested range and falls to 0 at {core.RANGE['o2']:g} points of O2, "
            f"{core.RANGE['pressure']:g} psi or {core.RANGE['flow']:g} cm/s away. A value the PSI "
            "table does not list counts as 0, because it cannot be checked.\n"
            "- **M_fuel**: 1 same fuel class, 0.5 related, 0.2 other.\n"
            "- **W_evidence**: 1 if the PSI table has one row per test, 0.6 if it is a summary."
        )
    pick = st.selectbox("Show the tests behind an investigation", ranking["Investigation"])
    tests = scored[scored["investigation"] == pick].sort_values("hfri", ascending=False)
    st.dataframe(
        tests[["test_id", "hfri", "fuel", "o2_raw", "pressure_raw", "flow_raw", "diluent", "outcome", "notes"]]
        .rename(columns={"test_id": "Test", "hfri": "HFRI", "fuel": "Fuel or sample", "o2_raw": "O2 (source)",
                         "pressure_raw": "Pressure (source)", "flow_raw": "Airflow (source)",
                         "diluent": "Diluent", "outcome": "Outcome", "notes": "Notes"}),
        hide_index=True, width="stretch",
        column_config={"HFRI": st.column_config.NumberColumn(format="%.2f")})

# ---------------------------------------------------------- oxygen coverage
with tab_cover:
    flames = cat[cat["fuel_class"].isin(CLASS_COLOR) & cat["o2_min"].notna() & (cat["gravity"] != "1g")]
    top_o2 = flames.groupby("fuel_class")["o2_max"].max()
    st.subheader(f"Solid fuels were tested up to {top_o2['solid']:g}% oxygen; "
                 f"droplets to {top_o2['liquid']:.0f}% and gases to {top_o2['gas']:.0f}%")
    st.markdown("Each mark is one test, or the end of a tested range. The dashed line is your scenario.")
    fig = go.Figure()
    for cls, label in (("solid", "Solid"), ("liquid", "Liquid droplet"), ("gas", "Gas")):
        g = flames[flames["fuel_class"] == cls]
        x = pd.concat([g["o2_min"], g["o2_max"]])
        y = pd.concat([g["investigation"], g["investigation"]])
        tid = pd.concat([g["test_id"], g["test_id"]]).astype(str)
        fig.add_trace(go.Scatter(
            x=x, y=y, mode="markers", name=label, customdata=tid,
            hovertemplate="<b>%{y}</b> test %{customdata}<br>O2 %{x:g}%<extra></extra>",
            marker=dict(color=CLASS_COLOR[cls], size=12, symbol="line-ns-open", line=dict(width=2))))
    fig.add_vline(x=o2, line=dict(color=GRAY, dash="dash", width=2),
                  annotation_text=f"{name}: {o2:g}% O2", annotation_position="top")
    fig.update_layout(height=380, margin=dict(l=10, r=10, t=50, b=40),
                      legend=dict(orientation="h", y=-0.25, x=0),
                      xaxis=dict(title="Oxygen (% by volume)", range=[10, max(45, o2 + 5)]),
                      yaxis=dict(title=None, autorange="reversed"))
    st.plotly_chart(fig, width="stretch")
    st.caption("Only investigations whose PSI table lists oxygen are shown. Saffire-III, SLICE, SAME "
               "and SAME-R list none. This covers the tables loaded here, not all of PSI.")

# ------------------------------------------------------------------ compare
with tab_compare:
    st.subheader("Compare investigations")
    names = list(cat["investigation"].unique())
    picked = st.multiselect("Investigations", names, default=["SAFFIRE-2", "BASS-II", "FLEX"], max_selections=4)
    if picked:
        st.table(pd.DataFrame({n: core.describe(cat, n) for n in picked}))
        st.caption("Every cell is read from the PSI experiment table. \"Not listed\" means the table is silent.")

# -------------------------------------------------------------------- about
with tab_about:
    a, b = st.columns(2)
    with a:
        st.subheader("Model-ready data")
        st.markdown(
            f"All {len(cat)} test records in one table: oxygen in %, pressure in psi, airflow in cm/s, "
            "with the original PSI text kept beside every converted value."
        )
        st.download_button("Download the full catalog (CSV)", cat.to_csv(index=False),
                           file_name="psi-combustion-catalog.csv", mime="text/csv")
        st.subheader("Limits")
        unnamed = int(((cat["fuel_class"] == "solid") & cat["material"].isna()).sum())
        st.markdown(
            f"- {len(cat)} rows from {cat['investigation'].nunique()} PSI experiment tables. PSI holds more.\n"
            "- Empty cells are left empty. No value is estimated.\n"
            f"- {unnamed} BASS-II rows name a shape but no material (for example \"1/4\\\" clear rod\"). "
            "They are not assigned to any material.\n"
            "- BASS-II lists a fan setting, not an air speed, and no pressure or outcome.\n"
            "- FLEX-2 and SLICE tables are summaries, not one row per test.\n"
            "- No investigation here ran in partial gravity."
        )
        st.subheader("On Earth")
        st.markdown(
            "The challenge statement names three Earth uses of this research: fine-water-mist "
            "extinguishers, smoke detection and firefighter gear. In the data loaded here, SAME and "
            f"SAME-R hold {len(cat[cat['investigation'].isin(['SAME', 'SAME-R'])])} smoke-particle tests, "
            f"and FLEX holds {len(cat[cat['investigation'] == 'FLEX'])} droplet tests, many with CO2 or "
            "helium added to the atmosphere."
        )
    with b:
        st.subheader("Sources")
        src = (cat.groupby("investigation", sort=False)
               .agg(psi_id=("psi_id", "first"), rows=("test_id", "size"), file=("source_file", "first")).reset_index())
        src["link"] = src["psi_id"].map(core.source_link)
        st.dataframe(
            src.rename(columns={"investigation": "Investigation", "psi_id": "PSI ID", "rows": "Rows",
                                "file": "PSI file", "link": "Record"}),
            hide_index=True, width="stretch",
            column_config={"Record": st.column_config.LinkColumn("Record", display_text="Open")})
        st.markdown("Data: NASA Physical Science Informatics, [psi.nasa.gov](https://psi.nasa.gov).")
        st.subheader("How SI is used")
        st.markdown(
            "On the brief page, a Gemini model writes one paragraph from the facts shown. Code then checks "
            "every number in that paragraph against those facts and removes any sentence that fails. "
            "The tables, counts, grades and charts are computed without SI."
        )
