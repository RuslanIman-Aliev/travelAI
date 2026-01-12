const getAddressComponent = (
  components: google.maps.GeocoderAddressComponent[],
  type: string
) => {
  return components.find((c) => c.types.includes(type))?.long_name || "";
};

export const getCityCountryAndCountryFromGeocode = async (
  lat: number,
  lng: number
) => {
  try {
    const geocoder = new google.maps.Geocoder();
    const latlng = { lat, lng };
    const response = await geocoder.geocode({ location: latlng });

    if (response.results[0]) {
      const addressComponents = response.results[0].address_components;

      const city =
        getAddressComponent(addressComponents, "locality") ||
        getAddressComponent(addressComponents, "administrative_area_level_1");
      const country = getAddressComponent(addressComponents, "country");

      return {
        city,
        country,
        fullAddress: response.results[0].formatted_address,
      };
    }
  } catch (error) {
    return { success: false, message: "Failed to reverse geocode coordinates" };
  }
};
