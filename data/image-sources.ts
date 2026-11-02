// Wikipedia articles whose Wikimedia Commons lead image illustrates each accessory family.
// Resolved (with licence + author) by scripts/fetch-images.ts.
export const ACCESSORY_ARTICLES: Record<string, string> = {
  "acc:terracotta-pot": "Flowerpot",
  "acc:ceramic-pot": "Plant_pot",
  "acc:hanging-basket": "Hanging_basket",
  "acc:potting-soil": "Potting_soil",
  "acc:perlite": "Perlite",
  "acc:fertilizer": "Fertilizer",
  "acc:watering-can": "Watering_can",
  "acc:pruning-shears": "Pruning_shears",
  "acc:trowel": "Trowel",
  "acc:humidifier": "Humidifier",
  "acc:moss": "Sphagnum",
  "acc:pebbles": "Expanded_clay_aggregate",
  "acc:gloves": "Gardening_glove",
};

// Explicit Commons files where the Wikipedia lead image is not a suitable product photo
// (e.g. the spider-plant article leads with a different species). Checked by eye.
export const IMAGE_OVERRIDES: Record<string, string> = {
  "species:chlorophytum-comosum": "File:Chlorophytum comosum in China.jpg",
  "species:ficus-benjamina": "File:Ficus benjamina-weeping fig-benjamin fig 01.jpg",
  "species:goeppertia-orbifolia": "File:Houseplant Calathea orbifolia.jpg",
  "acc:terracotta-pot": "File:Terraccotta Flower Pot.jpg",
  "acc:ceramic-pot": "File:Three-green-assorted-plants-in-white-ceramic-pots-776656.jpg",
  "acc:trowel": "File:Hand trowels.jpg",
  "acc:gloves": "File:A hand wearing bright floral gardening gloves.jpg",
  "acc:fertilizer": "File:NPK 19-19-19 Fertilizer (2).jpg",
  "acc:humidifier": "File:Ultrasonic humidifier.jpg",
};
