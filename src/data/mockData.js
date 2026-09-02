// Clean fallback dataset. Authentication and users always come from the API.
export const initialClients = [];

export const initialSystems = [
  { id: "SYS-AMADEUS", name: "Amadeus GDS", category: "GDS", code: "1A", color: "#6366f1" },
  { id: "SYS-SABRE", name: "Sabre Red 360", category: "GDS", code: "1S", color: "#0ea5e9" },
  { id: "SYS-KIU", name: "Kiu System Solutions", category: "GDS regional", code: "XX", color: "#10b981" },
  { id: "SYS-WINGO", name: "Wingo Direct B2B", category: "LCC Portal", code: "P5", color: "#f59e0b" },
  { id: "SYS-AVIANCA", name: "Avianca Direct / NDC", category: "NDC Channel", code: "AV", color: "#f43f5e" }
];

export const initialSignatures = [];

export const initialPublicContracts = [];

export const initialKaringLedger = [];

export const initialHotelInventory = [];

export const initialReservePackages = [];
