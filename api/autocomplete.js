const FALLBACK_ADDRESSES = [
  "1718 E Speedway Blvd, Tucson, AZ 85719",
  "1 E Washington St, Phoenix, AZ 85004",
  "4400 N Scottsdale Rd, Scottsdale, AZ 85251",
  "100 N Stone Ave, Tucson, AZ 85701",
  "805 S Rural Rd, Tempe, AZ 85281",
  "10220 N Metro Pkwy E, Phoenix, AZ 85051"
];

function fallbackResults(query) {
  const q = String(query || "").toLowerCase();
  if (q.length < 1) return [];

  const filtered = FALLBACK_ADDRESSES.filter((entry) => entry.toLowerCase().includes(q))
    .slice(0, 6)
    .map((entry) => {
      const parts = entry.split(",").map((p) => p.trim());
      const streetLine = parts[0] || "";
      const city = parts[1] || "";
      const stateZip = (parts[2] || "").split(" ").filter(Boolean);
      const stateCode = stateZip[0] || "";
      const postalCode = stateZip[1] || "";

      return {
        streetLine,
        city,
        stateCode,
        postalCode,
        cityStateZip: [city, [stateCode, postalCode].filter(Boolean).join(" ")].filter(Boolean).join(", "),
        formattedAddress: entry
      };
    });

  if (filtered.length) {
    return filtered;
  }

  if (/\d/.test(q)) {
    return FALLBACK_ADDRESSES.slice(0, 6).map((entry) => {
      const parts = entry.split(",").map((p) => p.trim());
      const streetLine = parts[0] || "";
      const city = parts[1] || "";
      const stateZip = (parts[2] || "").split(" ").filter(Boolean);
      const stateCode = stateZip[0] || "";
      const postalCode = stateZip[1] || "";

      return {
        streetLine,
        city,
        stateCode,
        postalCode,
        cityStateZip: [city, [stateCode, postalCode].filter(Boolean).join(" ")].filter(Boolean).join(", "),
        formattedAddress: entry
      };
    });
  }

  return [];
}

function mapRadarAddress(addr) {
  const streetLine = `${addr.number || ""} ${addr.street || ""}`.trim();
  const city = String(addr.city || "").trim();
  const stateCode = String(addr.stateCode || "").trim();
  const postalCode = String(addr.postalCode || "").trim();
  const formattedAddress = String(addr.formattedAddress || [streetLine, city, stateCode, postalCode].filter(Boolean).join(" ")).trim();

  return {
    streetLine,
    city,
    stateCode,
    postalCode,
    cityStateZip: [city, [stateCode, postalCode].filter(Boolean).join(" ")].filter(Boolean).join(", "),
    formattedAddress
  };
}

function mapGooglePrediction(prediction) {
  const description = String(prediction && prediction.description ? prediction.description : "").trim();
  const segments = description.split(",").map((part) => part.trim()).filter(Boolean);
  const streetLine = segments[0] || "";
  const city = segments[1] || "";

  let stateCode = "";
  let postalCode = "";
  if (segments[2]) {
    const stateZip = segments[2].split(" ").filter(Boolean);
    stateCode = stateZip[0] || "";
    postalCode = stateZip[1] || "";
  }

  return {
    streetLine,
    city,
    stateCode,
    postalCode,
    cityStateZip: [city, [stateCode, postalCode].filter(Boolean).join(" ")].filter(Boolean).join(", "),
    formattedAddress: description
  };
}

async function radarLookup(query, apiKey) {
  const endpoint = `https://api.radar.io/v1/search/autocomplete?query=${encodeURIComponent(query)}`;
  const response = await fetch(endpoint, {
    method: "GET",
    headers: {
      Authorization: apiKey
    }
  });

  if (!response.ok) {
    throw new Error(`Radar lookup failed with status ${response.status}`);
  }

  const rawData = await response.json();
  const addresses = Array.isArray(rawData && rawData.addresses) ? rawData.addresses : [];
  return addresses.slice(0, 6).map(mapRadarAddress).filter((item) => item.formattedAddress);
}

async function googleLookup(query, googleApiKey) {
  const endpoint =
    "https://maps.googleapis.com/maps/api/place/autocomplete/json"
    + `?input=${encodeURIComponent(query)}`
    + "&types=address"
    + "&components=country:us"
    + `&key=${encodeURIComponent(googleApiKey)}`;

  const response = await fetch(endpoint, { method: "GET" });
  if (!response.ok) {
    throw new Error(`Google lookup failed with status ${response.status}`);
  }

  const data = await response.json();
  const predictions = Array.isArray(data && data.predictions) ? data.predictions : [];
  return predictions.slice(0, 6).map(mapGooglePrediction).filter((item) => item.formattedAddress);
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const query = String((req.query && req.query.query) || "").trim();
  if (!query || query.length < 1) {
    return res.status(200).json({ results: [] });
  }

  const radarApiKey = process.env.RADAR_LIVE_PUBLIC_KEY;
  const googleApiKey = process.env.GOOGLE_MAPS_API_KEY;

  try {
    if (radarApiKey) {
      const radarResults = await radarLookup(query, radarApiKey);
      if (radarResults.length) {
        return res.status(200).json({ results: radarResults, source: "radar" });
      }
    }

    if (googleApiKey) {
      const googleResults = await googleLookup(query, googleApiKey);
      if (googleResults.length) {
        return res.status(200).json({ results: googleResults, source: "google" });
      }
    }

    return res.status(200).json({ results: fallbackResults(query), source: "fallback" });
  } catch (error) {
    console.error("Internal address lookup failure:", error);
    return res.status(200).json({ results: fallbackResults(query), source: "fallback" });
  }
}
