import { requireUserId } from "@/auth";
import { getAddressFromCoordinates } from "@/lib/actions/locations.actions";
import { resetRateLimits } from "@/lib/security";

jest.mock("@/auth", () => ({
  requireUserId: jest.fn(),
}));

const requireUserIdMock = requireUserId as jest.MockedFunction<
  typeof requireUserId
>;

const fetchMock = jest.fn();

/** Shaped like a real Google Geocoding response, trimmed to what is read. */
const addressResponse = {
  ok: true,
  json: async () => ({
    status: "OK",
    results: [
      {
        address_components: [
          { long_name: "10", types: ["street_number"] },
          { long_name: "Rue de Rivoli", types: ["route"] },
          { long_name: "Paris", types: ["locality", "political"] },
          { long_name: "France", types: ["country", "political"] },
        ],
      },
    ],
  }),
};

describe("getAddressFromCoordinates", () => {
  let consoleError: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    resetRateLimits();
    requireUserIdMock.mockResolvedValue("user_1");
    process.env.GOOGLE_PLACES_API_KEY = "test-key";
    global.fetch = fetchMock as unknown as typeof fetch;
    consoleError = jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleError.mockRestore();
  });

  it("flattens Google's address components into the parts the form shows", async () => {
    fetchMock.mockResolvedValue(addressResponse);

    await expect(getAddressFromCoordinates(48.86, 2.33)).resolves.toEqual({
      success: true,
      address: {
        house_number: "10",
        road: "Rue de Rivoli",
        town: undefined,
        city: "Paris",
        country: "France",
      },
    });
  });

  it("uses the already-billed Places key rather than a second vendor", async () => {
    fetchMock.mockResolvedValue(addressResponse);

    await getAddressFromCoordinates(48.86, 2.33);

    const url = String(fetchMock.mock.calls[0][0]);
    expect(url).toContain("maps.googleapis.com/maps/api/geocode/json");
    expect(url).toContain("key=test-key");
    expect(url).not.toContain("nominatim");
  });

  it("prefers postal_town for a UK-style address", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        status: "OK",
        results: [
          {
            address_components: [
              { long_name: "Baker Street", types: ["route"] },
              { long_name: "London", types: ["postal_town"] },
              {
                long_name: "Greater London",
                types: ["administrative_area_level_2"],
              },
              { long_name: "United Kingdom", types: ["country"] },
            ],
          },
        ],
      }),
    });

    const result = await getAddressFromCoordinates(51.52, -0.16);

    expect(result).toMatchObject({
      success: true,
      address: { town: "London", city: "Greater London" },
    });
  });

  it("reports a key without the Geocoding API enabled as an error", async () => {
    // Google answers this with HTTP 200 and a status field, so the response code
    // on its own is not enough to trust.
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ status: "REQUEST_DENIED" }),
    });

    await expect(getAddressFromCoordinates(48.86, 2.33)).resolves.toEqual({
      success: false,
      reason: "error",
    });
  });

  it("reports no match as an error", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ status: "ZERO_RESULTS", results: [] }),
    });

    await expect(getAddressFromCoordinates(0, 0)).resolves.toEqual({
      success: false,
      reason: "error",
    });
  });

  // The regression: both of the next two cases used to return `null`, so a user
  // who had merely clicked too fast was told their location could not be found.
  it("reports throttling separately from failure", async () => {
    fetchMock.mockResolvedValue(addressResponse);

    for (let i = 0; i < 10; i += 1) {
      await getAddressFromCoordinates(48.86, 2.33);
    }

    const result = await getAddressFromCoordinates(48.86, 2.33);

    expect(result).toEqual({
      success: false,
      reason: "rate-limited",
      retryAfterMs: expect.any(Number),
    });
    // Being throttled must not spend the upstream request it is protecting.
    expect(fetchMock).toHaveBeenCalledTimes(10);
  });

  it("reports an upstream failure as an error", async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 503 });

    await expect(getAddressFromCoordinates(48.86, 2.33)).resolves.toEqual({
      success: false,
      reason: "error",
    });
  });

  it("reports a rejected coordinate pair as an error without calling out", async () => {
    await expect(getAddressFromCoordinates(999, 2.33)).resolves.toEqual({
      success: false,
      reason: "error",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("reports a response with no components as an error", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ status: "OK", results: [{}] }),
    });

    await expect(getAddressFromCoordinates(48.86, 2.33)).resolves.toEqual({
      success: false,
      reason: "error",
    });
  });
});
