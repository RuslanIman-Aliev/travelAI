import { requireUserId } from "@/auth";
import { UserFacingError } from "@/lib/errors";
import { getGoogleNearbyPlaces } from "@/lib/google-maps-api";
import { resetRateLimits } from "@/lib/security";

jest.mock("@/auth", () => ({
  requireUserId: jest.fn(),
}));

const requireUserIdMock = requireUserId as jest.MockedFunction<
  typeof requireUserId
>;

const fetchMock = jest.fn();

const placesResponse = (places: unknown[]) => ({
  ok: true,
  json: async () => ({ places }),
});

const place = {
  id: "place_1",
  displayName: { text: "Louvre Museum" },
  formattedAddress: "Rue de Rivoli",
  primaryType: "art_gallery",
  rating: 4.8,
  userRatingCount: 100,
  location: { latitude: 48.8606, longitude: 2.3376 },
};

// `getGoogleNearbyPlaces` is a `"use server"` export, which makes it a public
// endpoint that spends money on every call. Its own boundary is the only thing
// standing between an anonymous caller and a billed Google Places request.
describe("getGoogleNearbyPlaces", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetRateLimits();
    requireUserIdMock.mockResolvedValue("user_1");
    process.env.GOOGLE_PLACES_API_KEY = "test-key";
    global.fetch = fetchMock as unknown as typeof fetch;
    fetchMock.mockResolvedValue(placesResponse([place]));
  });

  it("never reaches the Places API without a session", async () => {
    requireUserIdMock.mockRejectedValue(new UserFacingError("Unauthorized"));

    const result = await getGoogleNearbyPlaces(48.8566, 2.3522, 3_000);

    expect(fetchMock).not.toHaveBeenCalled();
    expect(result).toEqual({
      success: false,
      message: "Please sign in to search for places.",
    });
  });

  it("returns mapped places for a signed-in caller", async () => {
    const result = await getGoogleNearbyPlaces(48.8566, 2.3522, 3_000);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result).toEqual({
      success: true,
      places: [
        expect.objectContaining({
          id: "place_1",
          name: "Louvre Museum",
          category: "Art Gallery",
        }),
      ],
    });
  });

  it("sends the validated centre and radius to Google", async () => {
    await getGoogleNearbyPlaces(48.8566, 2.3522, 3_000);

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.locationRestriction.circle).toEqual({
      center: { latitude: 48.8566, longitude: 2.3522 },
      radius: 3_000,
    });
  });

  it.each([
    ["out-of-range latitude", 120, 2.3522, 3_000],
    ["out-of-range longitude", 48.8566, 200, 3_000],
    ["a radius past Google's ceiling", 48.8566, 2.3522, 500_000],
    ["a non-positive radius", 48.8566, 2.3522, 0],
  ])("rejects %s before paying for it", async (_label, lat, lng, radius) => {
    const result = await getGoogleNearbyPlaces(lat, lng, radius);

    expect(fetchMock).not.toHaveBeenCalled();
    expect(result).toEqual({
      success: false,
      message: "Invalid search location or radius.",
    });
  });

  it("stops a single user from hammering the billed endpoint", async () => {
    for (let i = 0; i < 10; i++) {
      await getGoogleNearbyPlaces(48.8566, 2.3522, 3_000);
    }
    fetchMock.mockClear();

    const result = await getGoogleNearbyPlaces(48.8566, 2.3522, 3_000);

    expect(fetchMock).not.toHaveBeenCalled();
    expect(result).toEqual({
      success: false,
      message: "Too many place searches. Please try again in a moment.",
    });
  });

  it("reports an upstream failure instead of an empty result", async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 403,
      text: async () => "key rejected",
    });
    jest.spyOn(console, "error").mockImplementation(() => {});

    const result = await getGoogleNearbyPlaces(48.8566, 2.3522, 3_000);

    expect(result).toEqual({
      success: false,
      message: "Could not reach the place search service.",
    });
  });
});
