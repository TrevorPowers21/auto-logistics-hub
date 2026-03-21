export interface DecodedVin {
  year: number;
  make: string;
  model: string;
  vehicleName: string;
}

interface VinApiResult {
  Make?: string;
  Model?: string;
  ModelYear?: string;
  Trim?: string;
  Series?: string;
  ErrorCode?: string;
}

interface VinApiResponse {
  Results?: VinApiResult[];
}

export async function decodeVin(vin: string): Promise<DecodedVin> {
  const normalizedVin = vin.trim().toUpperCase();
  if (normalizedVin.length < 11) {
    throw new Error("Enter a valid VIN.");
  }

  const response = await fetch(
    `https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValuesExtended/${normalizedVin}?format=json`,
  );

  if (!response.ok) {
    throw new Error("VIN lookup failed.");
  }

  const data = await response.json() as VinApiResponse;
  const result = data.Results?.[0];

  if (!result?.Make || !result?.Model || !result?.ModelYear) {
    throw new Error("VIN data not found.");
  }

  const vehicleName = [result.Make, result.Model, result.Series, result.Trim]
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();

  return {
    year: Number(result.ModelYear),
    make: result.Make,
    model: result.Model,
    vehicleName,
  };
}
