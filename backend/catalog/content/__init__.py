from .conseils_a import CONSEILS_A
from .conseils_b import CONSEILS_B
from .conseils_c import CONSEILS_C
from catalog.examples import EXCLUSIONS_DET001, IMPACT_DET001, RECOMMANDATION_DET001

CONSEILS = {
    "DET-001": {"exclusions": EXCLUSIONS_DET001, "recommandation": RECOMMANDATION_DET001, "impact": IMPACT_DET001},
    **CONSEILS_A, **CONSEILS_B, **CONSEILS_C,
}
