import type { PlannerQuestion } from "./planner";

export type HouseholdItemFamily =
  | "major_appliance"
  | "small_appliance"
  | "furniture"
  | "mounted_item"
  | "plumbing_fixture"
  | "electrical_fixture"
  | "door_window"
  | "storage_household"
  | "outdoor"
  | "specialty";

export type HouseholdItemTrait =
  | "bulky"
  | "heavy"
  | "fragile"
  | "keep_upright"
  | "water_connection"
  | "drain_connection"
  | "electric_connection"
  | "gas_connection"
  | "wall_fixed"
  | "assembly"
  | "doorway_fit"
  | "two_person"
  | "specialist_move";

export type HouseholdItemDefinition = {
  id: string;
  name: string;
  family: HouseholdItemFamily;
  aliases: string[];
  traits: HouseholdItemTrait[];
  possibleJobs: string[];
  resourceIds: string[];
  defaultCrew: number;
  safetyRules: string[];
};

const define = (
  id: string,
  name: string,
  family: HouseholdItemFamily,
  aliases: string[],
  traits: HouseholdItemTrait[],
  possibleJobs: string[],
  resourceIds: string[] = [],
  defaultCrew = 1,
  safetyRules: string[] = [],
): HouseholdItemDefinition => ({ id, name, family, aliases, traits, possibleJobs, resourceIds, defaultCrew, safetyRules });

const pickupJobs = ["pickup", "delivery", "room-to-room move", "placement", "removal", "disposal"];
const applianceJobs = [...pickupJobs, "unpack", "level", "connect", "commission", "replace old unit"];
const assemblyJobs = [...pickupJobs, "assemble", "adjust", "anchor", "remove packaging"];
const mountingJobs = [...pickupJobs, "install", "mount", "level", "secure", "remove"];

// This catalog is deliberately data-driven. New household items can be added
// without rewriting the planner: aliases identify the item, traits determine
// questions and safety, and possibleJobs describe the intents Doneeo supports.
export const HOUSEHOLD_ITEM_CATALOG: HouseholdItemDefinition[] = [
  define("refrigerator", "Refrigerator", "major_appliance", ["refrigerator", "fridge", "fridge freezer"], ["bulky", "heavy", "fragile", "keep_upright", "doorway_fit", "two_person", "electric_connection", "water_connection"], applianceJobs, ["vehicle", "straps", "blankets", "dolly", "level"], 2, ["Transport upright unless manufacturer instructions explicitly permit otherwise", "Protect refrigerant lines, doors, handles and finished surfaces", "Confirm manufacturer settling time before power-on", "Water-line work is included only when requested and eligible"]),
  define("freezer", "Freezer", "major_appliance", ["chest freezer", "upright freezer", "deep freezer", "freezer"], ["bulky", "heavy", "keep_upright", "doorway_fit", "two_person", "electric_connection"], applianceJobs, ["vehicle", "straps", "blankets", "dolly", "level"], 2),
  define("dishwasher", "Dishwasher", "major_appliance", ["dishwasher", "dish washer"], ["bulky", "heavy", "doorway_fit", "two_person", "water_connection", "drain_connection", "electric_connection"], applianceJobs, ["vehicle", "straps", "blankets", "dolly", "plumbing_tools", "plumbing_parts", "leak_protection", "level"], 2),
  define("washing_machine", "Washing machine", "major_appliance", ["washing machine", "clothes washer", "laundry washer", "washer"], ["bulky", "heavy", "keep_upright", "doorway_fit", "two_person", "water_connection", "drain_connection", "electric_connection"], applianceJobs, ["vehicle", "straps", "blankets", "dolly", "plumbing_tools", "leak_protection", "level"], 2),
  define("clothes_dryer", "Clothes dryer", "major_appliance", ["tumble dryer", "clothes dryer", "dryer"], ["bulky", "heavy", "doorway_fit", "two_person", "electric_connection"], applianceJobs, ["vehicle", "straps", "blankets", "dolly", "level"], 2),
  define("range", "Kitchen range", "major_appliance", ["electric range", "gas range", "kitchen range", "stove", "cooker"], ["bulky", "heavy", "doorway_fit", "two_person", "electric_connection", "gas_connection"], applianceJobs, ["vehicle", "straps", "blankets", "dolly", "appliance_install_tools", "appliance_connection_parts", "anti_tip", "level"], 2, ["Verify the energy source before matching installation eligibility", "Gas connection work requires an appropriately licensed professional", "Confirm the manufacturer anti-tip device is installed before commissioning"]),
  define("wall_oven", "Wall oven", "major_appliance", ["wall oven", "built in oven", "built-in oven"], ["bulky", "heavy", "two_person", "electric_connection", "gas_connection"], applianceJobs, ["vehicle", "straps", "blankets", "dolly", "level"], 2),
  define("microwave", "Microwave", "major_appliance", ["over the range microwave", "over-the-range microwave", "microwave oven", "microwave"], ["fragile", "electric_connection"], [...pickupJobs, "install", "mount", "connect", "test"], ["blankets", "dolly", "drill", "level"], 1),
  define("range_hood", "Range hood", "major_appliance", ["range hood", "cooker hood", "vent hood"], ["wall_fixed", "electric_connection", "two_person"], mountingJobs, ["drill", "stud_finder", "level", "ladder"], 2),
  define("air_conditioner", "Air conditioner", "major_appliance", ["window air conditioner", "window ac", "portable air conditioner", "portable ac", "air conditioner", "a/c unit"], ["bulky", "heavy", "electric_connection", "two_person"], [...pickupJobs, "install", "seal", "test", "seasonal removal"], ["vehicle", "straps", "blankets", "dolly", "level", "ladder"], 2),
  define("water_heater", "Water heater", "major_appliance", ["hot water tank", "water heater"], ["bulky", "heavy", "water_connection", "electric_connection", "gas_connection", "specialist_move"], applianceJobs, ["vehicle", "dolly", "plumbing_tools", "leak_protection"], 2),
  define("vacuum", "Vacuum cleaner", "small_appliance", ["vacuum cleaner", "shop vac", "shop-vac", "vacuum"], [], [...pickupJobs, "assemble", "maintenance"], [], 1),
  define("television", "Television", "mounted_item", ["television", "flat screen", "flat-screen", "smart tv", "tv"], ["fragile", "wall_fixed", "two_person"], mountingJobs, ["blankets", "drill", "stud_finder", "level", "mounting_hardware", "ladder"], 2),
  define("mirror", "Mirror", "mounted_item", ["wall mirror", "floor mirror", "mirror"], ["fragile", "wall_fixed", "two_person"], mountingJobs, ["blankets", "drill", "stud_finder", "level", "mounting_hardware"], 2),
  define("shelf", "Shelf or shelving", "mounted_item", ["floating shelves", "floating shelf", "wall shelves", "wall shelf", "shelving unit", "shelves", "shelf"], ["wall_fixed", "assembly"], mountingJobs, ["drill", "stud_finder", "level", "mounting_hardware", "ladder"], 1),
  define("picture_art", "Picture or wall art", "mounted_item", ["wall art", "picture frame", "picture", "artwork", "painting frame"], ["fragile", "wall_fixed"], mountingJobs, ["drill", "stud_finder", "level", "mounting_hardware", "ladder"], 1),
  define("curtain_rod", "Curtain rod", "mounted_item", ["curtain rods", "curtain rod", "drapery rod"], ["wall_fixed"], mountingJobs, ["drill", "stud_finder", "level", "mounting_hardware", "ladder"], 1),
  define("blinds", "Blinds or shades", "mounted_item", ["roller shades", "roller shade", "window blinds", "blinds", "shades"], ["wall_fixed"], mountingJobs, ["drill", "level", "mounting_hardware", "ladder"], 1),
  define("sofa", "Sofa or sectional", "furniture", ["sectional sofa", "sectional", "loveseat", "love seat", "chesterfield", "couch", "sofa"], ["bulky", "heavy", "doorway_fit", "two_person"], pickupJobs, ["vehicle", "straps", "blankets", "dolly"], 2),
  define("recliner", "Recliner", "furniture", ["reclining chair", "recliner"], ["bulky", "heavy", "doorway_fit", "two_person"], pickupJobs, ["vehicle", "straps", "blankets", "dolly"], 2),
  define("bed_frame", "Bed frame", "furniture", ["bunk bed", "platform bed", "bed frame", "bedframe"], ["bulky", "assembly", "doorway_fit", "two_person"], assemblyJobs, ["vehicle", "blankets", "dolly", "assembly_tools"], 2),
  define("mattress", "Mattress", "furniture", ["box spring", "mattress"], ["bulky", "doorway_fit", "two_person"], pickupJobs, ["vehicle", "straps", "blankets"], 2),
  define("dresser", "Dresser or chest", "furniture", ["chest of drawers", "drawer chest", "dresser"], ["bulky", "heavy", "doorway_fit", "two_person"], assemblyJobs, ["vehicle", "straps", "blankets", "dolly", "anti_tip"], 2),
  define("wardrobe", "Wardrobe or armoire", "furniture", ["armoire", "wardrobe"], ["bulky", "heavy", "assembly", "doorway_fit", "two_person", "wall_fixed"], assemblyJobs, ["vehicle", "straps", "blankets", "dolly", "assembly_tools", "anti_tip"], 2),
  define("dining_table", "Dining table", "furniture", ["dining room table", "dining table", "kitchen table", "table"], ["bulky", "assembly", "doorway_fit", "two_person"], assemblyJobs, ["vehicle", "straps", "blankets", "dolly", "assembly_tools"], 2),
  define("desk", "Desk", "furniture", ["standing desk", "office desk", "computer desk", "desk"], ["bulky", "assembly", "doorway_fit"], assemblyJobs, ["vehicle", "blankets", "dolly", "assembly_tools"], 1),
  define("chair", "Chair", "furniture", ["office chair", "dining chair", "chairs", "chair"], ["assembly"], assemblyJobs, ["vehicle", "blankets", "assembly_tools"], 1),
  define("bookcase", "Bookcase", "furniture", ["bookshelf", "bookcase"], ["bulky", "assembly", "wall_fixed"], assemblyJobs, ["vehicle", "blankets", "dolly", "assembly_tools", "anti_tip"], 1),
  define("cabinet", "Cabinet", "furniture", ["storage cabinet", "display cabinet", "cabinet"], ["bulky", "assembly", "wall_fixed"], assemblyJobs, ["vehicle", "blankets", "dolly", "assembly_tools", "anti_tip"], 1),
  define("tv_stand", "TV stand or media console", "furniture", ["media console", "entertainment unit", "tv stand"], ["bulky", "assembly"], assemblyJobs, ["vehicle", "blankets", "dolly", "assembly_tools"], 1),
  define("coffee_table", "Coffee table", "furniture", ["coffee table", "side table", "end table"], ["fragile", "assembly"], assemblyJobs, ["vehicle", "blankets", "assembly_tools"], 1),
  define("crib", "Crib", "furniture", ["baby crib", "cot", "crib"], ["assembly"], ["pickup", "delivery", "assemble", "manufacturer safety check", "disassemble"], ["vehicle", "blankets", "assembly_tools"], 1),
  define("toilet", "Toilet", "plumbing_fixture", ["toilet", "wc"], ["heavy", "water_connection", "drain_connection"], ["pickup", "delivery", "remove", "install", "seal", "leak-test", "dispose"], ["vehicle", "dolly", "plumbing_tools", "plumbing_parts", "leak_protection"], 1),
  define("sink", "Sink", "plumbing_fixture", ["kitchen sink", "bathroom sink", "wash basin", "sink"], ["heavy", "water_connection", "drain_connection"], ["pickup", "delivery", "remove", "install", "connect", "seal", "leak-test"], ["plumbing_tools", "plumbing_parts", "leak_protection"], 1),
  define("faucet", "Faucet or tap", "plumbing_fixture", ["kitchen faucet", "bathroom faucet", "tap", "faucet"], ["water_connection"], ["remove", "install", "connect", "leak-test", "repair"], ["plumbing_tools", "plumbing_parts", "leak_protection"], 1),
  define("vanity", "Bathroom vanity", "plumbing_fixture", ["bathroom vanity", "vanity unit", "vanity"], ["bulky", "heavy", "water_connection", "drain_connection", "wall_fixed", "two_person"], ["pickup", "delivery", "assemble", "remove", "install", "connect", "seal"], ["vehicle", "dolly", "drill", "level", "plumbing_tools", "leak_protection"], 2),
  define("shower_fixture", "Shower or tub fixture", "plumbing_fixture", ["shower fixture", "shower head", "bathtub faucet", "tub fixture"], ["water_connection"], ["remove", "install", "connect", "seal", "leak-test"], ["plumbing_tools", "plumbing_parts", "leak_protection"], 1),
  define("light_fixture", "Light fixture", "electrical_fixture", ["ceiling light", "light fixture", "chandelier", "pendant light"], ["fragile", "electric_connection", "wall_fixed"], ["pickup", "delivery", "remove", "install", "connect", "test"], ["electrical_tools", "electrical_parts", "ladder"], 1),
  define("ceiling_fan", "Ceiling fan", "electrical_fixture", ["ceiling fan"], ["heavy", "electric_connection", "wall_fixed", "two_person"], ["pickup", "delivery", "assemble", "remove", "install", "connect", "balance", "test"], ["electrical_tools", "electrical_parts", "ladder"], 2),
  define("lamp", "Lamp", "electrical_fixture", ["floor lamp", "table lamp", "plug-in lamp", "lamp"], ["fragile"], pickupJobs, ["blankets"], 1),
  define("door", "Door", "door_window", ["interior door", "exterior door", "storm door", "screen door", "door"], ["bulky", "heavy", "doorway_fit", "two_person"], ["pickup", "delivery", "remove", "install", "hang", "align", "weather-seal", "repair"], ["vehicle", "blankets", "dolly", "drill", "level"], 2),
  define("window", "Window", "door_window", ["replacement window", "window"], ["bulky", "heavy", "fragile", "two_person"], ["pickup", "delivery", "remove", "install", "seal", "repair"], ["vehicle", "straps", "blankets", "dolly", "level"], 2),
  define("lock", "Door lock", "door_window", ["smart lock", "deadbolt", "door lock", "lockset"], [], ["remove", "install", "configure", "test", "repair"], ["drill"], 1),
  define("boxes", "Boxes", "storage_household", ["moving boxes", "cardboard boxes", "boxes", "box"], [], ["pack", "label", "carry", "pickup", "delivery", "store", "unpack", "dispose"], ["vehicle", "straps", "dolly"], 1),
  define("storage_bins", "Storage bins", "storage_household", ["plastic totes", "storage totes", "storage bins", "storage bin", "totes"], [], ["sort", "label", "carry", "store", "pickup", "delivery"], ["vehicle", "dolly", "bins_labels"], 1),
  define("rug", "Rug or carpet", "storage_household", ["area rug", "carpet roll", "rug", "carpet"], ["bulky"], ["pickup", "delivery", "move", "unroll", "position", "remove", "clean"], ["vehicle", "straps", "blankets"], 2),
  define("lawn_mower", "Lawn mower", "outdoor", ["riding mower", "push mower", "lawn mower"], ["bulky", "heavy"], ["pickup", "delivery", "assemble", "maintenance", "seasonal storage"], ["vehicle", "straps", "ramp", "garden_tools"], 2),
  define("barbecue", "Barbecue or grill", "outdoor", ["gas grill", "charcoal grill", "bbq", "barbecue", "grill"], ["bulky", "heavy", "gas_connection"], ["pickup", "delivery", "assemble", "move", "clean", "remove"], ["vehicle", "straps", "blankets", "dolly", "assembly_tools"], 2),
  define("patio_furniture", "Patio furniture", "outdoor", ["outdoor furniture", "patio set", "patio furniture"], ["bulky", "assembly"], assemblyJobs, ["vehicle", "straps", "blankets", "assembly_tools"], 2),
  define("shed", "Garden shed", "outdoor", ["storage shed", "garden shed", "shed"], ["bulky", "heavy", "assembly", "two_person"], ["delivery", "site preparation", "assemble", "anchor", "repair", "remove"], ["vehicle", "assembly_tools", "drill", "level", "ladder"], 2),
  define("playset", "Playset", "outdoor", ["swing set", "play structure", "playset"], ["bulky", "heavy", "assembly", "two_person"], ["delivery", "site preparation", "assemble", "anchor", "inspect", "remove"], ["vehicle", "assembly_tools", "drill", "level", "ladder"], 2),
  define("piano", "Piano", "specialty", ["upright piano", "grand piano", "baby grand", "piano"], ["bulky", "heavy", "fragile", "doorway_fit", "specialist_move", "two_person"], ["specialist survey", "pickup", "delivery", "internal move", "placement"], ["vehicle", "straps", "blankets", "dolly"], 4, ["Specialist piano-moving equipment and experience required"]),
  define("safe", "Safe", "specialty", ["gun safe", "fire safe", "floor safe", "safe"], ["bulky", "heavy", "doorway_fit", "specialist_move", "two_person"], ["site survey", "pickup", "delivery", "internal move", "anchor", "remove"], ["vehicle", "straps", "blankets", "dolly"], 4, ["Confirm exact weight, floor load, stairs and anchoring before matching"]),
  define("pool_table", "Pool table", "specialty", ["billiard table", "pool table"], ["bulky", "heavy", "fragile", "specialist_move", "two_person"], ["specialist survey", "disassemble", "pickup", "delivery", "reassemble", "level"], ["vehicle", "straps", "blankets", "dolly", "level"], 4),
  define("aquarium", "Aquarium", "specialty", ["fish tank", "aquarium"], ["bulky", "heavy", "fragile", "water_connection", "specialist_move", "two_person"], ["prepare", "drain", "move", "pickup", "delivery", "place", "refill"], ["vehicle", "straps", "blankets", "dolly", "level"], 2),
  define("exercise_machine", "Exercise machine", "specialty", ["treadmill", "elliptical machine", "exercise bike", "rowing machine", "home gym"], ["bulky", "heavy", "assembly", "doorway_fit", "two_person"], assemblyJobs, ["vehicle", "straps", "blankets", "dolly", "assembly_tools"], 2),
];

function aliasPattern(alias: string) {
  const escaped = alias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+");
  return new RegExp(`\\b${escaped}s?\\b`, "i");
}

export function recognizeHouseholdItems(text: string) {
  const matches = HOUSEHOLD_ITEM_CATALOG.flatMap((item, catalogOrder) => {
    const aliases = item.aliases.flatMap(alias => {
      const match = aliasPattern(alias).exec(text);
      return match?.index === undefined ? [] : [{ position: match.index, end: match.index + match[0].length, aliasLength: match[0].length }];
    }).sort((left, right) => left.position - right.position || right.aliasLength - left.aliasLength);
    return aliases.length ? [{ item, catalogOrder, ...aliases[0] }] : [];
  });

  // Prefer the most specific phrase when aliases overlap. “Dish washer” is a
  // dishwasher, not both a dishwasher and a washing machine; “pool table” is
  // not also a dining table. Separate mentions remain separate catalog items.
  return matches
    .filter(candidate => !matches.some(other => other.item.id !== candidate.item.id
      && other.position <= candidate.position
      && other.end >= candidate.end
      && other.aliasLength > candidate.aliasLength))
    .sort((left, right) => left.position - right.position || left.catalogOrder - right.catalogOrder)
    .map(match => match.item);
}

function hasDimensions(text: string) {
  return /\b\d+(?:\.\d+)?\s*(?:inches?|in\b|"|cm|centimetres?|feet|ft|')\b|\b\d+\s*[x×]\s*\d+/i.test(text);
}

function hasWeight(text: string) {
  return /\b\d+(?:\.\d+)?\s*(?:kg|kilograms?|lb|lbs|pounds?)\b/i.test(text);
}

function hasModel(text: string) {
  return /\b(?:model|sku|item number|product number)\b.{0,45}\b[a-z0-9-]{3,}\b/i.test(text);
}

export function questionsForRecognizedItems(text: string): PlannerQuestion[] {
  const items = recognizeHouseholdItems(text);
  const questions: PlannerQuestion[] = [];
  const add = (question: PlannerQuestion, covered = false) => {
    if (!covered && !questions.some(existing => existing.id === question.id)) questions.push(question);
  };
  const transportIntent = /\b(?:pick\s*up|collect|deliver|bring|transport|move|carry|take)\b/i.test(text);

  for (const item of items) {
    const itemText = item.name.toLowerCase();
    if (transportIntent && item.traits.some(trait => ["bulky", "heavy", "doorway_fit", "fragile"].includes(trait))) {
      add({ id: `${item.id}_details`, label: `What are the ${itemText} model, dimensions and approximate weight?`, help: "A product link, model number, or width × depth × height is enough. This determines the vehicle, crew and doorway fit.", type: "text", required: true }, hasDimensions(text) && (hasWeight(text) || hasModel(text)));
    }
    if (transportIntent && item.traits.includes("doorway_fit")) {
      add({ id: `${item.id}_access_fit`, label: `Will the ${itemText} fit through the narrowest doorway, hallway and elevator on the route?`, help: "If unsure, provide the narrowest opening width or a photo before booking.", type: "choice", options: ["Yes — measurements checked", "May require door/handle removal", "Not sure — needs pre-check"], required: true }, /measurements? checked|doorway.{0,30}\d+|opening.{0,30}\d+|fits? through/i.test(text));
    }
    if (item.id === "refrigerator") {
      add({ id: "refrigerator_condition", label: "Is the refrigerator new and boxed, new but unboxed, or used?", help: "Packaging and condition change protection, inspection and handling evidence.", type: "choice", options: ["New and factory boxed", "New but unboxed", "Used and disconnected", "Used — disconnection still needed"], required: true }, /new(?:\s+and)?\s+(?:factory[- ]?)?boxed|new but unboxed|used and disconnected|disconnection still needed/i.test(text));
      add({ id: "refrigerator_pickup_ready", label: "Is the Costco refrigerator paid for, released and ready for pickup?", help: "Include the order holder or authorized pickup contact if someone else must release it.", type: "choice", options: ["Paid and ready", "Ready — pickup contact required", "Status not confirmed"], required: true }, /paid.{0,45}ready|ready.{0,45}paid|released.{0,35}pickup/i.test(text));
      add({ id: "refrigerator_destination_scope", label: "At the destination, what should the team do with the refrigerator?", type: "choice", options: ["Carry in and place only", "Place, level and connect power", "Connect an existing water line too", "Not sure — recommend the safe scope"], required: true }, /place only|level and connect|connect.{0,25}(?:power|water line)|delivery only|no installation/i.test(text));
      add({ id: "refrigerator_old_unit", label: "Should the existing refrigerator be moved or removed?", type: "choice", options: ["No existing unit to move", "Move it elsewhere in the home", "Remove it from the property", "Not sure"], required: true }, /no (?:old|existing) (?:refrigerator|fridge)|remove.{0,35}(?:old|existing) (?:refrigerator|fridge)|move.{0,35}(?:old|existing) (?:refrigerator|fridge)/i.test(text));
    }
    if (item.id === "range" && /\b(?:install|instal|connect|hook\s*up|set\s*up|replace)\b/i.test(text)) {
      add({ id: "range_condition", label: "Is the stove new and boxed, new but unboxed, or used?", help: "Condition and packaging affect pickup inspection and protection evidence.", type: "choice", options: ["New and factory boxed", "New but unboxed", "Used and disconnected", "Used — disconnection still needed"], required: true }, /new(?:\s+and)?\s+(?:factory[- ]?)?boxed|new but unboxed|used and disconnected|disconnection still needed/i.test(text));
      add({ id: "range_pickup_ready", label: "Is the Costco stove paid for, released and ready for pickup?", help: "Include the order holder or authorized pickup contact if someone else must release it.", type: "choice", options: ["Paid and ready", "Ready — pickup contact required", "Status not confirmed"], required: true }, /paid.{0,45}ready|ready.{0,45}paid|released.{0,35}pickup/i.test(text));
      add({ id: "range_connection_scope", label: "What connection is already available in the kitchen for this stove?", help: "New wiring, receptacle, gas-line or ventilation work changes provider eligibility and price.", type: "choice", options: ["Existing compatible electric receptacle", "Existing gas shutoff and connector location", "New or modified connection required", "Not sure"], required: true }, /existing compatible electric|existing gas shutoff|new or modified connection/i.test(text));
      add({ id: "range_parts", label: "Are the model-required power cord or gas connector and anti-tip bracket included?", type: "choice", options: ["All required parts included", "Some parts must be purchased", "Not sure"], required: true }, /all required parts included|parts must be purchased|power cord.{0,30}included|anti-tip.{0,30}included/i.test(text));
      add({ id: "range_old_unit", label: "Is an existing stove currently installed?", help: "If yes, Doneeo adds eligible disconnection, removal and relocation or disposal.", type: "choice", options: ["No existing stove", "Yes — move elsewhere in the home", "Yes — remove from the property", "Yes — disposal required"], required: true }, /no (?:old|existing) (?:stove|range)|(?:old|existing) (?:stove|range).{0,35}(?:move|remove|dispos)/i.test(text));
    }
    if (item.traits.includes("gas_connection") && /\b(?:install|instal|connect|disconnect|replace)\b/i.test(text)) {
      add({ id: `${item.id}_energy_source`, label: `Is the ${itemText} electric or gas-connected?`, type: "choice", options: ["Electric", "Gas", "Dual fuel", "Not sure"], required: true }, /\b(?:electric|gas|dual fuel)\b/i.test(text));
    }
    if (item.traits.includes("specialist_move")) {
      add({ id: `${item.id}_specialist_survey`, label: `What is the exact weight and complete access path for the ${itemText}?`, help: "Include stairs, landings, door widths, floor protection and final placement.", type: "text", required: true }, hasWeight(text) && /stairs?|door.{0,20}(?:width|wide)|ground floor|elevator/i.test(text));
    }
  }
  return questions;
}

export function catalogKnowledgeFacts(text: string) {
  return recognizeHouseholdItems(text).map(item => `Household catalog match: ${item.name} · ${item.possibleJobs.join(", ")}`);
}

export function catalogResourceIds(text: string) {
  return Array.from(new Set(recognizeHouseholdItems(text).flatMap(item => item.resourceIds)));
}

export function householdCatalogStats() {
  return {
    items: HOUSEHOLD_ITEM_CATALOG.length,
    families: new Set(HOUSEHOLD_ITEM_CATALOG.map(item => item.family)).size,
    jobRelations: HOUSEHOLD_ITEM_CATALOG.reduce((sum, item) => sum + item.possibleJobs.length, 0),
  };
}
