export type DetailInput = {
  key: string;
  label: string;
  placeholder: string;
  type?: "text" | "number";
};

export const detailedFieldsByService: Record<string, DetailInput[]> = {
  Drywall: [
    { key: "areaSqFt", label: "Approximate affected area (sq. ft.)", placeholder: "Example: 180", type: "number" },
    { key: "wallHeight", label: "Wall or ceiling height", placeholder: "Example: 8 ft. walls or 9 ft. ceiling" },
    { key: "boardThickness", label: "Known drywall thickness or type", placeholder: "Example: 1/2 in., fire-rated, moisture-resistant" },
    { key: "access", label: "Room and access details", placeholder: "Example: Finished basement, one flight of stairs" },
  ],
  Roofing: [
    { key: "roofArea", label: "Approximate roof area or home footprint", placeholder: "Example: 1,800 sq. ft. roof" },
    { key: "storeys", label: "Number of storeys and roof pitch", placeholder: "Example: Two storeys, medium pitch" },
    { key: "roofMaterial", label: "Existing roofing material and age", placeholder: "Example: Asphalt shingles, about 18 years old" },
    { key: "penetrations", label: "Chimneys, skylights, vents or valleys", placeholder: "Example: One chimney, two vents and a skylight" },
  ],
  Painting: [
    { key: "paintArea", label: "Approximate wall or surface area", placeholder: "Example: 1,200 sq. ft. of walls" },
    { key: "wallHeight", label: "Wall or ceiling height", placeholder: "Example: 9 ft.; stairwell reaches 16 ft." },
    { key: "coats", label: "Colours and expected coats", placeholder: "Example: Light grey over beige, two coats" },
    { key: "condition", label: "Current surface condition", placeholder: "Example: Small nail holes, one water stain" },
  ],
  Plumbing: [
    { key: "fixtureCount", label: "Number of fixtures or connections", placeholder: "Example: Two sinks and one toilet", type: "text" },
    { key: "pipeMaterial", label: "Known pipe material", placeholder: "Example: Copper supply and ABS drain" },
    { key: "access", label: "Access to pipes or shutoffs", placeholder: "Example: Open basement ceiling below bathroom" },
    { key: "distance", label: "Approximate distance to existing plumbing", placeholder: "Example: New sink is 6 ft. from current drain" },
  ],
  Electrical: [
    { key: "deviceCount", label: "Number of outlets, fixtures or circuits", placeholder: "Example: 8 outlets, 6 lights and 2 circuits" },
    { key: "panel", label: "Panel size, brand and available breaker spaces", placeholder: "Example: 200 A Siemens panel with 4 open spaces" },
    { key: "distance", label: "Distance from panel to new work", placeholder: "Example: About 35 ft. to the laundry room" },
    { key: "access", label: "Wall, ceiling, attic or crawlspace access", placeholder: "Example: Unfinished basement ceiling is open" },
  ],
  HVAC: [
    { key: "homeArea", label: "Approximate conditioned area", placeholder: "Example: 2,100 sq. ft.", type: "text" },
    { key: "equipment", label: "Equipment type, model and age", placeholder: "Example: 12-year-old Lennox gas furnace" },
    { key: "zones", label: "Floors, zones or rooms affected", placeholder: "Example: Second floor is not cooling" },
    { key: "access", label: "Equipment and duct access", placeholder: "Example: Furnace in basement utility room" },
  ],
  "Junk removal": [
    { key: "volume", label: "Estimated volume", placeholder: "Example: Half a 15-yard truck" },
    { key: "itemCount", label: "Large or heavy items", placeholder: "Example: Sofa, fridge, mattress and 20 bags" },
    { key: "access", label: "Pickup access and stairs", placeholder: "Example: Basement, 12 stairs, side-door access" },
    { key: "materials", label: "Material types or restricted items", placeholder: "Example: Wood, drywall, metal; no paint or chemicals" },
  ],
  Landscaping: [
    { key: "siteArea", label: "Approximate outdoor area or dimensions", placeholder: "Example: 35 x 60 ft. back yard" },
    { key: "accessWidth", label: "Gate or equipment access width", placeholder: "Example: 42 in. side gate" },
    { key: "grade", label: "Slope, drainage and soil condition", placeholder: "Example: Slopes toward the house; clay soil" },
    { key: "materials", label: "Preferred materials or plants", placeholder: "Example: Kentucky bluegrass sod and limestone" },
  ],
  Moving: [
    { key: "inventory", label: "Rooms, boxes and large-item count", placeholder: "Example: 2 bedrooms, 45 boxes, sofa and dining set" },
    { key: "distance", label: "Pickup-to-destination distance", placeholder: "Example: 18 km within Hamilton" },
    { key: "pickupAccess", label: "Pickup stairs, elevator and parking", placeholder: "Example: Third floor, elevator booked, loading area" },
    { key: "dropoffAccess", label: "Destination stairs, elevator and parking", placeholder: "Example: Two-storey house, driveway access" },
  ],
  Carpentry: [
    { key: "dimensions", label: "Approximate dimensions", placeholder: "Example: 12 x 16 ft. deck, 3 ft. above grade" },
    { key: "material", label: "Preferred wood or finish", placeholder: "Example: Pressure-treated lumber with black railing" },
    { key: "condition", label: "Existing structure condition", placeholder: "Example: Old framing remains but decking is rotten" },
    { key: "access", label: "Work-area access", placeholder: "Example: 36 in. gate; materials carried 60 ft." },
  ],
  Flooring: [
    { key: "floorArea", label: "Approximate floor area", placeholder: "Example: 850 sq. ft.", type: "text" },
    { key: "rooms", label: "Rooms, stairs and transitions", placeholder: "Example: Four rooms, hallway and 12 stairs" },
    { key: "existingFloor", label: "Existing flooring and subfloor", placeholder: "Example: Carpet over plywood" },
    { key: "newMaterial", label: "Preferred new flooring", placeholder: "Example: 7 mm luxury vinyl plank" },
  ],
  "General contracting": [
    { key: "projectArea", label: "Approximate project area", placeholder: "Example: 900 sq. ft. basement", type: "text" },
    { key: "ceilingHeight", label: "Ceiling or wall height", placeholder: "Example: 8 ft. basement ceiling" },
    { key: "rooms", label: "Rooms and spaces included", placeholder: "Example: Rec room, bathroom, laundry and storage" },
    { key: "plans", label: "Plans, permits and structural information", placeholder: "Example: Designer drawings complete; permit not submitted" },
  ],
};

export const jobSpecificOptions: Record<string, Record<string, string[]>> = {
  Drywall: {
    "Repair damage": ["Patch holes under 6 in.", "Replace damaged sheets", "Repair water damage", "Repair cracks or popped screws", "Match existing texture", "Replace damaged insulation"],
    "Install new drywall": ["Frame new walls", "Install wall board", "Install ceiling board", "Use moisture-resistant board", "Use fire-rated board", "Add corner bead and backing"],
    "Tape and finish": ["Tape new seams", "Apply three finish coats", "Sand ready for primer", "Level 5 finish", "Repair previous finishing", "Prime completed surfaces"],
    "Ceiling work": ["Repair ceiling damage", "Install new ceiling board", "Remove textured ceiling", "Match stipple or texture", "Add resilient channel", "Work around lights or vents"],
    "Insulation and vapour barrier": ["Remove old insulation", "Install batt insulation", "Install sound insulation", "Repair vapour barrier", "Seal rim joists", "Close walls with drywall"],
    "Soundproofing": ["Insulate wall cavities", "Install resilient channel", "Install sound-rated drywall", "Seal penetrations", "Isolate a ceiling", "Finish ready for paint"],
  },
  Roofing: {
    "Repair a leak": ["Diagnose leak source", "Replace damaged shingles", "Repair flashing", "Seal roof penetrations", "Repair underlayment", "Inspect attic moisture"],
    "Replace the roof": ["Remove existing roof", "Install ice and water shield", "Install new shingles", "Replace vents", "Replace flashing", "Dispose of old materials"],
    "Replace shingles": ["Replace missing shingles", "Repair wind damage", "Match existing colour", "Repair a roof section", "Seal exposed fasteners", "Inspect nearby underlayment"],
    "Flat roof work": ["Patch membrane", "Replace flat-roof membrane", "Improve drainage", "Repair parapet flashing", "Replace roof drain", "Add insulation"],
    "Eavestrough, soffit or fascia": ["Replace eavestroughs", "Add downspouts", "Repair soffit", "Replace fascia", "Install leaf guards", "Redirect drainage"],
    "Skylight or flashing": ["Replace skylight", "Repair skylight leak", "Reflash chimney", "Reflash wall intersection", "Install new roof vent", "Repair valley flashing"],
  },
  Painting: {
    "Interior painting": ["Paint walls", "Paint ceilings", "Paint trim and doors", "Patch small holes", "Prime stains or new drywall", "Move and protect furniture"],
    "Exterior painting": ["Paint siding", "Paint trim and soffit", "Paint doors or shutters", "Scrape and sand", "Caulk gaps", "Prime bare surfaces"],
    "Cabinet refinishing": ["Remove doors and hardware", "Degrease and sand", "Spray cabinet boxes", "Spray doors and drawers", "Install new hardware", "Repair damaged doors"],
    "Staining or specialty finish": ["Stain deck or fence", "Strip old coating", "Apply clear protective coat", "Colour-match existing finish", "Whitewash or limewash", "Decorative feature wall"],
    "Trim, doors and ceilings": ["Paint baseboards", "Paint window and door trim", "Paint interior doors", "Paint ceilings", "Repair caulking", "Prime stained wood"],
    "Commercial painting": ["Paint office walls", "Paint retail space", "After-hours work", "Low-odour coating", "Line marking", "Protect operating areas"],
  },
  Plumbing: {
    "Repair a leak": ["Repair supply-line leak", "Repair drain leak", "Replace shutoff valve", "Repair pipe joint", "Repair toilet leak", "Open and close wall access"],
    "Install a fixture": ["Install toilet", "Install sink or vanity", "Install faucet", "Install shower valve", "Install bathtub", "Connect dishwasher or fridge"],
    "Clear a drain": ["Clear sink drain", "Clear toilet blockage", "Clear main drain", "Camera inspection", "Hydro-jetting", "Repair damaged drain"],
    "Water heater": ["Replace tank water heater", "Install tankless heater", "Repair existing heater", "Upgrade venting", "Add mixing valve", "Remove old equipment"],
    "Sump pump or backwater valve": ["Replace sump pump", "Add battery backup", "Install new sump pit", "Install backwater valve", "Repair discharge line", "Test drainage system"],
    "New addition or renovation plumbing": ["Bathroom rough-in", "Kitchen rough-in", "Laundry rough-in", "Add water and drain lines", "Relocate existing plumbing", "Arrange permit and inspection"],
  },
  Electrical: {
    "Electrical repair": ["Diagnose power loss", "Repair faulty outlet", "Repair tripping circuit", "Replace damaged wiring", "Correct unsafe connection", "Electrical safety inspection"],
    "Full electrical for addition": ["Design circuit layout", "Install receptacles", "Install lighting circuits", "Install smoke and CO devices", "Connect HVAC or appliances", "Permit and ESA inspection"],
    "Dryer or range hookup": ["Install 240 V dryer circuit", "Install electric range circuit", "Install receptacle", "Run cable from panel", "Add breaker", "Relocate existing hookup"],
    "Lighting installation": ["Install pot lights", "Install ceiling fixture", "Install exterior lighting", "Add dimmers or controls", "Relocate fixtures", "Repair switches"],
    "Panel or service upgrade": ["Replace electrical panel", "Upgrade 100 A to 200 A", "Add subpanel", "Replace breakers", "Coordinate utility disconnect", "Permit and ESA inspection"],
    "EV charger installation": ["Install Level 2 charger", "Run dedicated circuit", "Load calculation", "Install outdoor charger", "Add energy-management device", "Permit and ESA inspection"],
    "Outlets or new circuits": ["Add standard outlets", "Add GFCI outlets", "Add dedicated appliance circuit", "Add outdoor receptacle", "Relocate outlets", "Install USB or smart outlets"],
    "Generator or backup power": ["Install generator inlet", "Install transfer switch", "Connect portable generator", "Install standby generator", "Add critical-load panel", "Test backup system"],
  },
  HVAC: {
    "Heating repair": ["Diagnose no heat", "Repair ignition system", "Replace blower motor", "Repair gas furnace", "Repair boiler", "Balance heat distribution"],
    "Air-conditioning repair": ["Diagnose no cooling", "Repair refrigerant leak", "Replace capacitor or contactor", "Repair condenser", "Clear condensate drain", "Test system performance"],
    "Replace furnace or air conditioner": ["Size new equipment", "Remove old equipment", "Install furnace", "Install air conditioner", "Modify venting", "Commission system"],
    "Heat pump installation": ["Whole-home heat pump", "Ductless mini-split", "Hybrid heat-pump system", "Electrical coordination", "Outdoor unit pad", "Commission and balance"],
    "Ductwork or ventilation": ["Add supply runs", "Add return-air runs", "Repair damaged ducts", "Seal duct leakage", "Install bathroom exhaust", "Install kitchen exhaust"],
    "Thermostat or controls": ["Install smart thermostat", "Repair thermostat wiring", "Add zoning controls", "Relocate thermostat", "Connect humidifier control", "Program equipment"],
  },
  "Junk removal": {
    "Household junk": ["Remove furniture", "Remove bagged waste", "Remove garage items", "Remove basement items", "Donate usable items", "Sweep pickup area"],
    "Construction debris": ["Remove drywall", "Remove lumber", "Remove flooring", "Remove concrete or masonry", "Provide bin", "Separate recyclable material"],
    "Appliance removal": ["Remove refrigerator", "Remove washer or dryer", "Remove stove", "Remove freezer", "Disconnect appliance", "Recycle metal"],
    "Estate or property cleanout": ["Full-home cleanout", "Sort donations", "Remove furniture", "Remove personal items", "Remove outdoor items", "Final broom clean"],
    "Yard waste": ["Remove branches", "Remove soil or sod", "Remove fencing", "Remove patio debris", "Remove shed contents", "Chip brush"],
    "Commercial cleanout": ["Office furniture", "Retail fixtures", "Warehouse contents", "Renovation debris", "After-hours pickup", "Provide disposal documentation"],
  },
  Landscaping: {
    "Lawn and garden care": ["Mow and edge", "Garden cleanup", "Prune shrubs", "Mulch beds", "Weed control", "Seasonal maintenance"],
    "Sod or grading": ["Remove old lawn", "Regrade soil", "Add topsoil", "Install sod", "Seed lawn", "Improve drainage slope"],
    "Interlock or hardscape": ["Install patio", "Install walkway", "Repair settled interlock", "Install base and bedding", "Add steps", "Seal pavers"],
    "Fence or outdoor structure": ["Install wood fence", "Replace fence", "Install gates", "Build pergola", "Build privacy screen", "Remove old structure"],
    "Drainage work": ["Install French drain", "Install catch basin", "Extend downspouts", "Regrade beside foundation", "Install swale", "Connect solid drainage pipe"],
    "Retaining wall": ["Remove existing wall", "Excavate and prepare base", "Install block wall", "Install timber wall", "Add drainage stone", "Restore surrounding grade"],
  },
  Moving: {
    "Full home move": ["Load entire home", "Transport belongings", "Unload by room", "Disassemble furniture", "Reassemble furniture", "Protect floors and doors"],
    "Apartment move": ["Elevator coordination", "Load apartment", "Transport belongings", "Unload apartment", "Move balcony or locker items", "Protect common areas"],
    "Furniture delivery": ["Pickup furniture", "Blanket-wrap items", "Deliver furniture", "Carry upstairs", "Assemble furniture", "Remove packaging"],
    "Packing help": ["Supply boxes", "Pack kitchen", "Pack fragile items", "Pack full home", "Label boxes", "Unpack at destination"],
    "Office move": ["Move desks and chairs", "Move files", "Move electronics", "Disassemble workstations", "After-hours move", "Set up at destination"],
    "Heavy or specialty item": ["Move piano", "Move safe", "Move appliance", "Move pool table", "Move gym equipment", "Arrange specialty equipment"],
    "Long-distance move": ["Dedicated truck", "Shared load", "Packing service", "Storage stop", "Delivery window", "Inventory documentation"],
  },
  Carpentry: {
    "Finish carpentry": ["Install baseboards", "Install crown moulding", "Install window trim", "Install door casing", "Build feature wall", "Fill and finish nail holes"],
    "Framing for addition or renovation": ["Frame exterior walls", "Frame interior walls", "Frame openings", "Frame floor system", "Frame roof structure", "Coordinate structural drawings"],
    "Deck": ["Remove old deck", "Install footings", "Frame deck", "Install decking", "Build stairs", "Install railing"],
    "Fence": ["Remove old fence", "Set posts", "Install fence panels", "Build gates", "Add privacy lattice", "Stain or seal"],
    "Cabinetry or built-ins": ["Build custom cabinets", "Install stock cabinets", "Build shelving", "Build entertainment unit", "Install hardware", "Add finished panels and trim"],
    "Doors or windows": ["Install interior door", "Install exterior door", "Install window", "Repair frame or sill", "Install hardware", "Add interior and exterior trim"],
    "Custom woodwork": ["Build bench", "Build mantel", "Build stairs", "Build table or furniture", "Create wall panelling", "Match existing woodwork"],
  },
  Flooring: {
    "Install new flooring": ["Prepare subfloor", "Install hardwood", "Install laminate", "Install vinyl plank", "Install underlayment", "Install transitions"],
    "Replace existing flooring": ["Remove old flooring", "Dispose of old material", "Repair subfloor", "Install new flooring", "Reinstall trim", "Move furniture"],
    "Repair damaged flooring": ["Replace damaged boards", "Repair water damage", "Fix squeaks", "Repair transitions", "Patch vinyl or laminate", "Blend repair with existing floor"],
    "Refinish hardwood": ["Sand existing floor", "Repair gaps", "Stain floor", "Apply clear finish", "Refinish stairs", "Dust containment"],
    "Tile installation": ["Remove existing tile", "Install uncoupling membrane", "Install floor tile", "Install wall tile", "Grout and seal", "Install heated floor"],
    "Carpet installation": ["Remove old carpet", "Install new underpad", "Install carpet", "Carpet stairs", "Move furniture", "Dispose of old material"],
    "Stairs and nosing": ["Install stair treads", "Install risers", "Install nosing", "Refinish stairs", "Install carpet runner", "Repair stair squeaks"],
  },
  "General contracting": {
    "Basement renovation": ["Framing", "Insulation and drywall", "Electrical", "Plumbing", "Bathroom", "Flooring", "Painting", "Ceiling", "Laundry room", "Storage or built-ins"],
    "Kitchen renovation": ["Demolition", "Cabinets", "Countertops", "Sink and plumbing", "Electrical and lighting", "Backsplash", "Flooring", "Painting", "Appliances", "Structural wall changes"],
    "Bathroom renovation": ["Toilet addition or replacement", "New sink or vanity", "Bathtub replacement", "New shower", "Tile and waterproofing", "Plumbing relocation", "Electrical and lighting", "Exhaust fan", "Flooring", "Painting"],
    "Addition": ["Design and permits", "Excavation and foundation", "Framing", "Roofing", "Windows and doors", "Full electrical", "Plumbing", "HVAC", "Insulation and drywall", "Interior finishes"],
    "Whole-home renovation": ["Design and planning", "Demolition", "Structural work", "Kitchen", "Bathrooms", "Electrical", "Plumbing", "HVAC", "Flooring", "Painting and finishes"],
    "Multi-room renovation": ["Living areas", "Bedrooms", "Kitchen", "Bathrooms", "Laundry", "Flooring", "Trim and doors", "Lighting", "Painting", "Project coordination"],
  },
};

