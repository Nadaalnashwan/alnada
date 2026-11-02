// Commercial catalogue (DEMO DATA). Prices in SAR and stock levels are simulated for this
// educational project and are labelled as demo data throughout the UI.

import type { ProductKind } from "@/lib/plants/types";

type Flags = { featured?: boolean; best?: boolean; isNew?: boolean; compareAt?: number };

export interface PlantProductSource extends Flags {
  species: string;
  sku: string;
  price: number;
  stock: number;
  variant_en: string;
  variant_ar: string;
  /** Optional slug suffix for additional sizes of the same species. */
  suffix?: string;
}

const pot = (cm: number) => ({ variant_en: `${cm} cm nursery pot`, variant_ar: `أصيص تربية ${cm} سم` });

export const PLANT_PRODUCTS: PlantProductSource[] = [
  { species: "monstera-deliciosa", sku: "PL-MON-DEL-M", price: 189, stock: 24, ...pot(21), featured: true, best: true },
  { species: "monstera-deliciosa", sku: "PL-MON-DEL-XL", price: 449, stock: 6, variant_en: "XL with moss pole, 120 cm", variant_ar: "حجم كبير مع عمود طحلب، ١٢٠ سم", suffix: "xl" },
  { species: "monstera-adansonii", sku: "PL-MON-ADA-S", price: 79, stock: 18, ...pot(15), isNew: true },
  { species: "epipremnum-aureum", sku: "PL-EPI-AUR-S", price: 49, stock: 40, ...pot(14), best: true },
  { species: "dracaena-trifasciata", sku: "PL-DRA-TRI-M", price: 95, stock: 35, ...pot(17), best: true, featured: true },
  { species: "dracaena-trifasciata", sku: "PL-DRA-TRI-L", price: 219, stock: 10, variant_en: "Tall, 90 cm", variant_ar: "طويلة، ٩٠ سم", suffix: "tall" },
  { species: "zamioculcas-zamiifolia", sku: "PL-ZAM-ZAM-M", price: 119, stock: 28, ...pot(19), best: true },
  { species: "chlorophytum-comosum", sku: "PL-CHL-COM-S", price: 45, stock: 30, ...pot(14) },
  { species: "spathiphyllum-wallisii", sku: "PL-SPA-WAL-M", price: 89, stock: 22, ...pot(17), featured: true },
  { species: "ficus-elastica", sku: "PL-FIC-ELA-M", price: 149, stock: 16, ...pot(21) },
  { species: "ficus-lyrata", sku: "PL-FIC-LYR-L", price: 349, stock: 8, variant_en: "Tree form, 110 cm", variant_ar: "على شكل شجرة، ١١٠ سم", featured: true },
  { species: "chamaedorea-elegans", sku: "PL-CHA-ELE-M", price: 99, stock: 20, ...pot(17) },
  { species: "peperomia-obtusifolia", sku: "PL-PEP-OBT-S", price: 55, stock: 25, ...pot(12) },
  { species: "pilea-peperomioides", sku: "PL-PIL-PEP-S", price: 59, stock: 18, ...pot(12), isNew: true },
  { species: "maranta-leuconeura", sku: "PL-MAR-LEU-S", price: 65, stock: 14, ...pot(14) },
  { species: "goeppertia-orbifolia", sku: "PL-GOE-ORB-M", price: 135, stock: 9, ...pot(17), isNew: true },
  { species: "aloe-vera", sku: "PL-ALO-VER-S", price: 39, stock: 45, ...pot(12), best: true },
  { species: "haworthiopsis-attenuata", sku: "PL-HAW-ATT-S", price: 35, stock: 30, ...pot(9) },
  { species: "echeveria-elegans", sku: "PL-ECH-ELE-S", price: 32, stock: 36, ...pot(9) },
  { species: "crassula-ovata", sku: "PL-CRA-OVA-M", price: 85, stock: 15, ...pot(17) },
  { species: "beaucarnea-recurvata", sku: "PL-BEA-REC-M", price: 165, stock: 12, ...pot(19), featured: true },
  { species: "bougainvillea-glabra", sku: "PL-BOU-GLA-L", price: 129, stock: 20, variant_en: "Trained on cane, 100 cm", variant_ar: "مربوطة على دعامة، ١٠٠ سم", best: true },
  { species: "salvia-rosmarinus", sku: "PL-SAL-ROS-S", price: 35, stock: 25, ...pot(14) },
  { species: "ocimum-basilicum", sku: "PL-OCI-BAS-S", price: 25, stock: 40, ...pot(12) },
  { species: "mentha-spicata", sku: "PL-MEN-SPI-S", price: 25, stock: 50, ...pot(12), best: true },
  { species: "aglaonema-commutatum", sku: "PL-AGL-COM-M", price: 115, stock: 18, ...pot(17) },
  { species: "philodendron-hederaceum", sku: "PL-PHI-HED-S", price: 59, stock: 26, ...pot(14) },
  { species: "dypsis-lutescens", sku: "PL-DYP-LUT-L", price: 239, stock: 10, variant_en: "Floor plant, 140 cm", variant_ar: "نبتة أرضية، ١٤٠ سم" },
  { species: "strelitzia-reginae", sku: "PL-STR-REG-L", price: 289, stock: 7, variant_en: "Floor plant, 100 cm", variant_ar: "نبتة أرضية، ١٠٠ سم", isNew: true },
  { species: "hoya-carnosa", sku: "PL-HOY-CAR-S", price: 69, stock: 15, ...pot(12) },
  { species: "nephrolepis-exaltata", sku: "PL-NEP-EXA-M", price: 75, stock: 14, ...pot(17) },
  { species: "jasminum-sambac", sku: "PL-JAS-SAM-M", price: 69, stock: 30, ...pot(17), best: true, featured: true },
  { species: "lavandula-angustifolia", sku: "PL-LAV-ANG-S", price: 45, stock: 20, ...pot(14) },
  { species: "catharanthus-roseus", sku: "PL-CAT-ROS-S", price: 22, stock: 60, ...pot(12) },
  { species: "nerium-oleander", sku: "PL-NER-OLE-L", price: 119, stock: 12, variant_en: "Shrub, 80 cm", variant_ar: "شجيرة، ٨٠ سم" },
  { species: "phoenix-roebelenii", sku: "PL-PHO-ROE-L", price: 329, stock: 6, variant_en: "Terrace palm, 120 cm", variant_ar: "نخلة تراس، ١٢٠ سم", featured: true },
  { species: "ixora-coccinea", sku: "PL-IXO-COC-M", price: 59, stock: 18, ...pot(17) },
  { species: "portulaca-grandiflora", sku: "PL-POR-GRA-S", price: 19, stock: 50, ...pot(12) },
  { species: "echinocactus-grusonii", sku: "PL-ECH-GRU-S", price: 55, stock: 16, ...pot(14) },
  { species: "curio-rowleyanus", sku: "PL-CUR-ROW-S", price: 65, stock: 14, variant_en: "Hanging pot, 15 cm", variant_ar: "أصيص معلق، ١٥ سم", isNew: true },
  { species: "tradescantia-zebrina", sku: "PL-TRA-ZEB-S", price: 39, stock: 20, ...pot(12) },
  { species: "phalaenopsis-hybrid", sku: "PL-PHA-HYB-M", price: 129, stock: 20, variant_en: "2 flower spikes", variant_ar: "ساقين مزهرين" },
  { species: "anthurium-andraeanum", sku: "PL-ANT-AND-M", price: 109, stock: 15, ...pot(14) },
  { species: "dracaena-marginata", sku: "PL-DRA-MAR-L", price: 199, stock: 10, variant_en: "Multi-stem, 100 cm", variant_ar: "متعددة السيقان، ١٠٠ سم" },
  { species: "pelargonium-graveolens", sku: "PL-PEL-GRA-S", price: 35, stock: 22, ...pot(14) },
  { species: "hedera-helix", sku: "PL-HED-HEL-S", price: 39, stock: 18, ...pot(14) },
  { species: "kalanchoe-blossfeldiana", sku: "PL-KAL-BLO-S", price: 29, stock: 35, ...pot(12) },
  { species: "gardenia-jasminoides", sku: "PL-GAR-JAS-M", price: 89, stock: 12, ...pot(17) },
  { species: "adenium-obesum", sku: "PL-ADE-OBE-M", price: 149, stock: 9, variant_en: "Grafted, bonsai-style", variant_ar: "مطعمة، على طراز البونساي", featured: true },
  { species: "ficus-benjamina", sku: "PL-FIC-BEN-L", price: 179, stock: 10, variant_en: "Tree form, 110 cm", variant_ar: "على شكل شجرة، ١١٠ سم" },
  { species: "schefflera-arboricola", sku: "PL-SCH-ARB-M", price: 85, stock: 16, ...pot(17) },
  { species: "calathea-makoyana", sku: "PL-CAL-MAK-M", price: 99, stock: 8, ...pot(14) },
];

export interface GiftProductSource extends Flags {
  species: string;
  sku: string;
  slug: string;
  name_en: string;
  name_ar: string;
  description_en: string;
  description_ar: string;
  price: number;
  stock: number;
}

export const GIFT_PRODUCTS: GiftProductSource[] = [
  { species: "phalaenopsis-hybrid", sku: "GF-ORCHID-WHITE", slug: "gift-orchid-ceramic", price: 249, stock: 10, featured: true, compareAt: 279,
    name_en: "Orchid Gift in White Ceramic", name_ar: "هدية أوركيد في أصيص سيراميك أبيض",
    description_en: "A double-spike moth orchid in a glazed white ceramic pot with a handwritten card.",
    description_ar: "أوركيد فراشة بساقين مزهرين في أصيص سيراميك أبيض لامع مع بطاقة مكتوبة بخط اليد." },
  { species: "jasminum-sambac", sku: "GF-FULL-GIFT", slug: "gift-arabian-jasmine", price: 159, stock: 12,
    name_en: "Arabian Jasmine Gift", name_ar: "هدية الفل العربي",
    description_en: "Fragrant full in a terracotta pot, wrapped in natural linen.",
    description_ar: "فل عطري في أصيص فخار، مغلف بقماش كتان طبيعي." },
  { species: "anthurium-andraeanum", sku: "GF-ANTHURIUM", slug: "gift-anthurium-red", price: 189, stock: 8,
    name_en: "Red Anthurium Gift", name_ar: "هدية الأنثوريوم الأحمر",
    description_en: "A flowering anthurium in a ceramic pot — a long-lasting alternative to cut flowers.",
    description_ar: "أنثوريوم مزهر في أصيص سيراميك؛ بديل يدوم أطول من الورد المقطوف." },
  { species: "echeveria-elegans", sku: "GF-SUCC-TRIO", slug: "gift-succulent-trio", price: 119, stock: 15, isNew: true,
    name_en: "Succulent Trio Gift Box", name_ar: "صندوق هدية ثلاث عصاريات",
    description_en: "Echeveria with two companion succulents in matching mini terracotta pots.",
    description_ar: "إيشيفيريا مع عصاريتين مرافقتين في أصص فخار صغيرة متطابقة." },
];

export interface AccessorySource extends Flags {
  sku: string;
  slug: string;
  kind: Exclude<ProductKind, "plant" | "gift">;
  image: string;
  name_en: string;
  name_ar: string;
  description_en: string;
  description_ar: string;
  variant_en: string;
  variant_ar: string;
  price: number;
  stock: number;
}

const acc = (
  sku: string, slug: string, kind: AccessorySource["kind"], image: string,
  name_en: string, name_ar: string, description_en: string, description_ar: string,
  variant_en: string, variant_ar: string, price: number, stock: number, flags: Flags = {},
): AccessorySource => ({ sku, slug, kind, image, name_en, name_ar, description_en, description_ar, variant_en, variant_ar, price, stock, ...flags });

export const ACCESSORY_PRODUCTS: AccessorySource[] = [
  acc("PT-TER-12", "terracotta-pot-12", "pot", "acc:terracotta-pot", "Classic Terracotta Pot", "أصيص فخار كلاسيكي", "Breathable unglazed clay with a drainage hole; ideal for succulents and herbs.", "فخار غير مطلي يسمح بتنفس التربة مع فتحة تصريف؛ مثالي للعصاريات والأعشاب.", "12 cm with saucer", "١٢ سم مع صحن", 19, 60),
  acc("PT-TER-18", "terracotta-pot-18", "pot", "acc:terracotta-pot", "Classic Terracotta Pot", "أصيص فخار كلاسيكي", "Breathable unglazed clay with a drainage hole; ideal for succulents and herbs.", "فخار غير مطلي يسمح بتنفس التربة مع فتحة تصريف؛ مثالي للعصاريات والأعشاب.", "18 cm with saucer", "١٨ سم مع صحن", 35, 45, { best: true }),
  acc("PT-TER-25", "terracotta-pot-25", "pot", "acc:terracotta-pot", "Classic Terracotta Pot", "أصيص فخار كلاسيكي", "Breathable unglazed clay with a drainage hole; ideal for succulents and herbs.", "فخار غير مطلي يسمح بتنفس التربة مع فتحة تصريف؛ مثالي للعصاريات والأعشاب.", "25 cm with saucer", "٢٥ سم مع صحن", 55, 30),
  acc("PT-CER-14", "ceramic-pot-white-14", "pot", "acc:ceramic-pot", "Matte White Ceramic Pot", "أصيص سيراميك أبيض مطفي", "Minimal glazed ceramic with drainage hole and cork plug.", "سيراميك مطلي بتصميم بسيط مع فتحة تصريف وسدادة فلين.", "14 cm", "١٤ سم", 45, 40, { featured: true }),
  acc("PT-CER-20", "ceramic-pot-white-20", "pot", "acc:ceramic-pot", "Matte White Ceramic Pot", "أصيص سيراميك أبيض مطفي", "Minimal glazed ceramic with drainage hole and cork plug.", "سيراميك مطلي بتصميم بسيط مع فتحة تصريف وسدادة فلين.", "20 cm", "٢٠ سم", 75, 30),
  acc("PT-CER-28", "ceramic-pot-white-28", "pot", "acc:ceramic-pot", "Matte White Ceramic Pot", "أصيص سيراميك أبيض مطفي", "Minimal glazed ceramic with drainage hole and cork plug.", "سيراميك مطلي بتصميم بسيط مع فتحة تصريف وسدادة فلين.", "28 cm floor pot", "٢٨ سم أصيص أرضي", 129, 15, { isNew: true }),
  acc("PT-HANG-20", "hanging-basket-20", "pot", "acc:hanging-basket", "Hanging Basket Planter", "سلة تعليق للنباتات", "A hanging planter with chains, for trailing plants.", "أصيص معلق مع سلاسل للنباتات المتدلية.", "20 cm", "٢٠ سم", 49, 25),
  acc("SL-IND-5", "indoor-potting-mix-5l", "soil", "acc:potting-soil", "Indoor Potting Mix", "تربة النباتات الداخلية", "Peat-free mix with bark and perlite for aroids and foliage plants.", "خلطة بدون بيتموس مع لحاء وبيرلايت للنباتات الورقية.", "5 L", "٥ لتر", 25, 80, { best: true }),
  acc("SL-IND-20", "indoor-potting-mix-20l", "soil", "acc:potting-soil", "Indoor Potting Mix", "تربة النباتات الداخلية", "Peat-free mix with bark and perlite for aroids and foliage plants.", "خلطة بدون بيتموس مع لحاء وبيرلايت للنباتات الورقية.", "20 L", "٢٠ لتر", 69, 40),
  acc("SL-CAC-5", "cactus-succulent-mix-5l", "soil", "acc:potting-soil", "Cactus & Succulent Mix", "تربة الصبار والعصاريات", "Fast-draining gritty mix to prevent root rot.", "خلطة حصوية سريعة التصريف تمنع تعفن الجذور.", "5 L", "٥ لتر", 29, 50),
  acc("SL-PER-4", "perlite-4l", "soil", "acc:perlite", "Horticultural Perlite", "بيرلايت زراعي", "Lightens heavy soil and improves drainage and aeration.", "يخفف التربة الثقيلة ويحسن التصريف والتهوية.", "4 L", "٤ لتر", 22, 45),
  acc("SL-MOSS-1", "sphagnum-moss", "soil", "acc:moss", "Sphagnum Moss", "طحلب سفاجنم", "Holds moisture for moss poles, orchids and propagation.", "يحتفظ بالرطوبة لأعمدة الطحلب والأوركيد والإكثار.", "150 g", "١٥٠ جم", 32, 30),
  acc("SL-LECA-5", "clay-pebbles-5l", "soil", "acc:pebbles", "Expanded Clay Pebbles", "حبيبات الطين المتمدد (ليكا)", "A drainage layer and humidity-tray filler.", "طبقة تصريف وحشوة لصواني الرطوبة.", "5 L", "٥ لتر", 35, 35),
  acc("FT-LIQ-500", "liquid-fertilizer", "soil", "acc:fertilizer", "Balanced Houseplant Feed", "سماد متوازن للنباتات المنزلية", "Gentle balanced NPK feed; dilute in water every 2–4 weeks in the growing season.", "سماد NPK متوازن ولطيف؛ يخفف في الماء كل ٢–٤ أسابيع في موسم النمو.", "500 ml", "٥٠٠ مل", 39, 50, { featured: true }),
  acc("FT-GRAN-1", "slow-release-granules", "soil", "acc:fertilizer", "Slow-Release Granules", "سماد بطيء الذوبان", "Feeds outdoor plants for up to three months per application.", "يغذي النباتات الخارجية حتى ثلاثة أشهر لكل استخدام.", "1 kg", "١ كجم", 45, 40),
  acc("AC-CAN-1", "metal-watering-can", "accessory", "acc:watering-can", "Metal Watering Can", "مرشّة ري معدنية", "Long-spout can for precise watering at the soil line.", "مرشة بفوهة طويلة للري الدقيق عند مستوى التربة.", "1.5 L", "١٫٥ لتر", 65, 25, { best: true }),
  acc("AC-SHEAR", "pruning-shears", "accessory", "acc:pruning-shears", "Bypass Pruning Shears", "مقص تقليم", "Sharp steel blades for clean cuts on stems and branches.", "شفرات فولاذية حادة لقص نظيف للسيقان والأغصان.", "20 cm", "٢٠ سم", 59, 30),
  acc("AC-TROWEL", "hand-trowel-set", "accessory", "acc:trowel", "Hand Trowel Set", "طقم مجارف يدوية", "Two trowels for repotting and mixing soil.", "مجرفتان لإعادة الزراعة وخلط التربة.", "2 pieces", "قطعتان", 45, 30),
  acc("AC-GLOVE", "gardening-gloves", "accessory", "acc:gloves", "Gardening Gloves", "قفازات زراعة", "Breathable gloves that protect against thorns and sap.", "قفازات تسمح بالتهوية وتحمي من الأشواك والعصارة.", "Medium", "مقاس متوسط", 29, 40),
  acc("AC-HUMID", "ultrasonic-humidifier", "accessory", "acc:humidifier", "Ultrasonic Plant Humidifier", "جهاز ترطيب للنباتات", "Raises humidity for calatheas, ferns and orchids in air-conditioned rooms.", "يرفع الرطوبة للكالاثيا والسرخس والأوركيد في الغرف المكيفة.", "2 L tank", "خزان ٢ لتر", 149, 12, { isNew: true }),
];
