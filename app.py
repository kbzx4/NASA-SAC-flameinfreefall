import pandas as pd
import plotly.graph_objects as go
import streamlit as st

import core

st.set_page_config(page_title="Flame in Freefall: Gravity Bound", page_icon="🔥", layout="wide")

BLUE, ORANGE, AQUA, GRAY = "#2a78d6", "#eb6834", "#1baf7a", "#8a8a85"
CLASS_COLOR = {"solid": BLUE, "liquid": ORANGE, "gas": AQUA}


@st.cache_data
def data():
    return core.load_catalog(), core.load_pairs()


cat, pairs = data()

# ------------------------------------------------------------------ sidebar
with st.sidebar:
    st.header("Your habitat")
    name = st.selectbox("Scenario", list(core.SCENARIOS))
    preset = core.SCENARIOS[name]
    st.caption(preset["note"])
    custom = name == "Custom"
    o2 = st.slider("Oxygen (% by volume)", 10.0, 100.0, preset["o2"], 0.5, disabled=not custom)
    pressure = st.slider("Pressure (psi)", 3.0, 45.0, preset["pressure"], 0.1, disabled=not custom)
    flow = st.slider("Ventilation airflow (cm/s)", 0.0, 40.0, 10.0, 1.0,
                     help="Set this to your habitat's air speed. The default of 10 cm/s is a placeholder, not a NASA value.")
    fuel_label = st.selectbox("What are you worried about?", list(core.FUEL_CLASSES))
    fuel_class = core.FUEL_CLASSES[fuel_label]
    gravity_label = st.selectbox("Gravity", list(core.GRAVITY))
    gravity = core.GRAVITY[gravity_label]

# ------------------------------------------------------------------- header
st.title("Flame in Freefall")
st.markdown(
    "**Which microgravity fire experiments matter for your habitat, and what do microgravity and "
    "normal-gravity results together say about the Moon and Mars, where no test data exists?**"
)
st.warning("Research tool, not an operational safety system. It ranks and compares published NASA "
           "test records. It does not predict whether a material will burn.", icon="⚠️")
if gravity != "ug":
    st.info(f"**{gravity_label}: no test data.** None of the {cat['investigation'].nunique()} "
            "investigations loaded here ran in partial gravity. The rankings below use microgravity "
            "tests. The Gravity bound tab shows the range that microgravity and 1g results leave open.",
            icon="🌙")

tab_bound, tab_rank, tab_cover, tab_compare, tab_about = st.tabs(
    ["Gravity bound", "Ranked evidence", "Oxygen coverage", "Compare", "Earth, limits and sources"])

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
    scored = core.score_tests(cat, o2, pressure, flow, fuel_class)
    ranking = core.rank_investigations(scored, o2, pressure, flow, fuel_class)
    top = ranking.iloc[0]
    st.subheader(f"Most relevant evidence for {name}: {top['Investigation']}")
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
            f"table does not list counts as {core.UNKNOWN}.\n"
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
    chosen = st.multiselect("Investigations", names, default=["SAFFIRE-2", "BASS-II", "FLEX"], max_selections=4)
    if chosen:
        table = pd.DataFrame({n: core.describe(cat, n) for n in chosen})
        st.table(table)
        st.caption("Every cell is read from the PSI experiment table. \"Not listed\" means the table is silent.")

# -------------------------------------------------------------------- about
with tab_about:
    a, b = st.columns(2)
    with a:
        st.subheader("On Earth")
        st.markdown(
            "The challenge statement names three Earth uses of this research: fine-water-mist "
            "extinguishers, smoke detection and firefighter gear. In the data loaded here:\n"
            f"- **Smoke detection**: SAME and SAME-R, "
            f"{len(cat[cat['investigation'].isin(['SAME', 'SAME-R'])])} smoke-particle tests on "
            "overheated Teflon, Kapton, silicone, lampwick and Pyrell.\n"
            f"- **Suppression**: FLEX, {len(cat[cat['investigation'] == 'FLEX'])} droplet tests, "
            "many with CO2 or helium added to the atmosphere."
        )
        st.subheader("Limits")
        st.markdown(
            f"- {len(cat)} rows from {cat['investigation'].nunique()} PSI experiment tables. PSI holds more.\n"
            "- Empty cells are left empty. No value is estimated.\n"
            "- BASS-II lists a fan setting, not an air speed, and no pressure or outcome.\n"
            "- FLEX-2 and SLICE tables are summaries, not one row per test.\n"
            "- No investigation here ran in partial gravity."
        )
    with b:
        st.subheader("Sources")
        src = (cat.groupby("investigation", sort=False)
               .agg(psi_id=("psi_id", "first"), rows=("test_id", "size"), doi=("doi", "first"),
                    file=("source_file", "first")).reset_index())
        src["link"] = src["psi_id"].map(core.source_link)
        st.dataframe(
            src[["investigation", "psi_id", "rows", "file", "link"]].rename(columns={
                "investigation": "Investigation", "psi_id": "PSI ID", "rows": "Rows",
                "file": "PSI file", "link": "Record"}),
            hide_index=True, width="stretch",
            column_config={"Record": st.column_config.LinkColumn("Record", display_text="Open")})
        st.markdown("Data: NASA Physical Science Informatics, [psi.nasa.gov](https://psi.nasa.gov). "
                    "Cleaning decisions are logged in `DATA_NOTES.md` in the repository.")
