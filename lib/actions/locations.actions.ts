"use server";

export async function getAddressFromCoordinates(lat: number, lng: number) {
  const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&accept-language=en`;

  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "TravelGuideApp/1.0 s0970802047@gmail.com",
      },
    });

    if (!response.ok) {
      throw new Error(`Nominatim API error: ${response.statusText}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Failed to fetch address:", error);
    return null;
  }
}