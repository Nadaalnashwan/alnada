// Category definitions and the attribute rules that assign products to them.
// Rules run once at seed time to materialise the product_categories join table,
// so a product appears in every category it qualifies for without duplicating records.

import type { Product, Species } from "./types";

export interface CategoryDef {
  slug: string;
  name_en: string;
  name_ar: string;
  description_en: string;
  description_ar: string;
  /** Species slug whose photo represents the category. */
  cover: string;
  rule: (p: Pick<Product, "kind">, s: Species | null) => boolean;
}

const isPlant = (p: Pick<Product, "kind">) => p.kind === "plant" || p.kind === "gift";
const plant = (fn: (s: Species) => boolean) => (p: Pick<Product, "kind">, s: Species | null) => isPlant(p) && !!s && fn(s);

export const CATEGORY_DEFS: CategoryDef[] = [
  { slug: "indoor", name_en: "Indoor Plants", name_ar: "النباتات الداخلية", cover: "monstera-deliciosa",
    description_en: "Plants that thrive inside homes and offices.", description_ar: "نباتات تزدهر داخل البيوت والمكاتب.",
    rule: plant((s) => s.placement.includes("indoor")) },
  { slug: "outdoor", name_en: "Outdoor Plants", name_ar: "النباتات الخارجية", cover: "bougainvillea-glabra",
    description_en: "Tough plants for gardens, terraces and courtyards.", description_ar: "نباتات قوية للحدائق والتراسات والأحواش.",
    rule: plant((s) => s.placement.includes("outdoor")) },
  { slug: "cacti-succulents", name_en: "Cacti & Succulents", name_ar: "الصبارات والعصاريات", cover: "echeveria-elegans",
    description_en: "Water-storing plants made for bright, dry conditions.", description_ar: "نباتات تخزن الماء ومصممة للأجواء المضيئة الجافة.",
    rule: plant((s) => s.succulent) },
  { slug: "flowering", name_en: "Flowering Plants", name_ar: "النباتات المزهرة", cover: "phalaenopsis-hybrid",
    description_en: "Colour and fragrance for every corner.", description_ar: "ألوان وروائح لكل زاوية.",
    rule: plant((s) => s.flowering) },
  { slug: "aromatic", name_en: "Aromatic Plants", name_ar: "النباتات العطرية", cover: "jasminum-sambac",
    description_en: "Herbs and scented plants, from mint to Arabian jasmine.", description_ar: "أعشاب ونباتات عطرية، من النعناع إلى الفل.",
    rule: plant((s) => s.aromatic) },
  { slug: "climbing", name_en: "Climbing Plants", name_ar: "النباتات المتسلقة", cover: "monstera-adansonii",
    description_en: "Vines that climb poles, trellises and walls.", description_ar: "متسلقات للأعمدة والتعريشات والجدران.",
    rule: plant((s) => s.habit === "climbing") },
  { slug: "hanging", name_en: "Hanging Plants", name_ar: "النباتات المعلقة", cover: "curio-rowleyanus",
    description_en: "Trailing plants for shelves and hanging baskets.", description_ar: "نباتات متدلية للرفوف والسلال المعلقة.",
    rule: plant((s) => s.habit === "trailing") },
  { slug: "office", name_en: "Office Plants", name_ar: "نباتات المكاتب", cover: "zamioculcas-zamiifolia",
    description_en: "Easy plants that cope with office light and air conditioning.", description_ar: "نباتات سهلة تتحمل إضاءة المكاتب والمكيفات.",
    rule: plant((s) => s.placement.includes("indoor") && s.difficulty === "easy" && (s.light.includes("low") || s.light.includes("medium"))) },
  { slug: "beginner", name_en: "Beginner-Friendly Plants", name_ar: "نباتات للمبتدئين", cover: "epipremnum-aureum",
    description_en: "Forgiving plants for your first green steps.", description_ar: "نباتات متسامحة لأول خطواتك الخضراء.",
    rule: plant((s) => s.difficulty === "easy") },
  { slug: "low-maintenance", name_en: "Low-Maintenance Plants", name_ar: "نباتات قليلة العناية", cover: "dracaena-trifasciata",
    description_en: "Drought-tolerant plants for busy people and frequent travellers.", description_ar: "نباتات تتحمل العطش للمشغولين وكثيري السفر.",
    rule: plant((s) => s.difficulty === "easy" && s.water === "low") },
  { slug: "low-light", name_en: "Low-Light Plants", name_ar: "نباتات الإضاءة المنخفضة", cover: "aglaonema-commutatum",
    description_en: "Plants that tolerate rooms far from windows.", description_ar: "نباتات تتحمل الغرف البعيدة عن الشبابيك.",
    rule: plant((s) => s.light.includes("low")) },
  { slug: "full-sun", name_en: "Full-Sun Plants", name_ar: "نباتات الشمس المباشرة", cover: "adenium-obesum",
    description_en: "Sun lovers for bright, hot spots.", description_ar: "محبة للشمس للأماكن المضيئة الحارة.",
    rule: plant((s) => s.light.includes("full_sun")) },
  { slug: "balcony", name_en: "Balcony Plants", name_ar: "نباتات البلكونات", cover: "catharanthus-roseus",
    description_en: "Compact, heat-tolerant plants for Saudi balconies.", description_ar: "نباتات صغيرة تتحمل الحرارة لبلكونات السعودية.",
    rule: plant((s) => s.placement.includes("outdoor") && (s.heat_tolerant || s.light.includes("full_sun")) && s.size !== "large") },
  { slug: "pet-friendly", name_en: "Pet-Friendly Plants", name_ar: "نباتات مناسبة للحيوانات", cover: "chlorophytum-comosum",
    description_en: "Listed as non-toxic to both cats and dogs by the ASPCA.", description_ar: "مصنفة غير سامة للقطط والكلاب حسب قائمة ASPCA.",
    rule: plant((s) => s.toxicity.cats === "non_toxic" && s.toxicity.dogs === "non_toxic") },
  { slug: "large", name_en: "Large Plants", name_ar: "النباتات الكبيرة", cover: "ficus-lyrata",
    description_en: "Statement plants and indoor trees.", description_ar: "نباتات لافتة وأشجار داخلية.",
    rule: plant((s) => s.size === "large") },
  { slug: "small", name_en: "Small Plants", name_ar: "النباتات الصغيرة", cover: "pilea-peperomioides",
    description_en: "Desk, shelf and windowsill companions.", description_ar: "رفقاء المكتب والرف وحافة الشباك.",
    rule: plant((s) => s.size === "small") },
  { slug: "gifts", name_en: "Plant Gifts", name_ar: "الهدايا النباتية", cover: "anthurium-andraeanum",
    description_en: "Ready-to-gift plants in decorative pots.", description_ar: "نباتات جاهزة للإهداء في أصص مزخرفة.",
    rule: (p) => p.kind === "gift" },
  { slug: "pots", name_en: "Pots & Planters", name_ar: "الأصص", cover: "acc:ceramic-pot",
    description_en: "Terracotta, ceramic and hanging planters.", description_ar: "أصص فخار وسيراميك وأصص معلقة.",
    rule: (p) => p.kind === "pot" },
  { slug: "soil-fertilizers", name_en: "Soil & Fertilizers", name_ar: "التربة والأسمدة", cover: "acc:potting-soil",
    description_en: "Mixes, amendments and plant food.", description_ar: "خلطات تربة ومحسنات وأسمدة.",
    rule: (p) => p.kind === "soil" },
  { slug: "care-accessories", name_en: "Care Accessories", name_ar: "مستلزمات العناية", cover: "acc:watering-can",
    description_en: "Tools that make plant care easier.", description_ar: "أدوات تسهّل العناية بالنباتات.",
    rule: (p) => p.kind === "accessory" },
  { slug: "all-plants", name_en: "All Plants", name_ar: "جميع النباتات", cover: "ficus-elastica",
    description_en: "Every plant in the AL NADA collection.", description_ar: "كل نباتات مجموعة الندى.",
    rule: (p) => isPlant(p) },
];
