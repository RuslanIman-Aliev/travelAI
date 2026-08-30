"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MyModal } from "@/components/utils/my-dialog";
import { saveLiveGuideRoute } from "@/lib/actions/live-guide.actions";
import { getAddressFromCoordinates } from "@/lib/actions/locations.actions";
import { getGoogleNearbyPlaces } from "@/lib/google-maps-api";
import { LiveGuideFormValues, MappedPlace } from "@/lib/types";
import { cn } from "@/lib/utils";
import { formSchema } from "@/lib/validators";
import { RADIUS_OPTIONS } from "@/lib/variables";
import { zodResolver } from "@hookform/resolvers/zod";
import { AlertCircle, Check, MapPin, Star } from "lucide-react";
import { useState } from "react";
import { Controller, ControllerRenderProps, useForm } from "react-hook-form";
import { toast } from "sonner";

const MAX_SELECTED_PLACES = 10;

/**
 * Builds a Google Maps directions URL from the user's position through every
 * selected place, ending at the furthest one.
 *
 * @param {{lat: number, lng: number}} origin - The traveller's coordinates.
 * @param {MappedPlace[]} orderedPlaces - Places already sorted by distance.
 * @returns {string} A Google Maps directions link.
 */
const buildDirectionsUrl = (
  origin: { lat: number; lng: number },
  orderedPlaces: MappedPlace[],
) => {
  const destination = orderedPlaces[orderedPlaces.length - 1];
  const waypoints = orderedPlaces
    .slice(0, -1)
    .map((place) => `${place.location.lat},${place.location.lng}`)
    .join("|");

  const params = new URLSearchParams({
    api: "1",
    origin: `${origin.lat},${origin.lng}`,
    destination: `${destination.location.lat},${destination.location.lng}`,
    travelmode: "driving",
  });

  if (waypoints) params.set("waypoints", waypoints);

  return `https://www.google.com/maps/dir/?${params.toString()}`;
};

const LiveGuideForm = () => {
  const form = useForm<LiveGuideFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      location: "",
      radius: "",
      selectedPlaces: [],
    },
  });

  const { errors } = form.formState;
  const radiusValue = form.watch("radius");
  const selectedCount = form.watch("selectedPlaces")?.length ?? 0;

  const [googleMapsUrl, setGoogleMapsUrl] = useState("");
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(
    null,
  );
  const [availablePlaces, setAvailablePlaces] = useState<MappedPlace[]>([]);
  const [isLocating, setIsLocating] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const handleUserLocation = () => {
    if (!navigator.geolocation) {
      toast.error("Geolocation is not supported by your browser.");
      return;
    }

    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude: lat, longitude: lng } = position.coords;
        setCoords({ lat, lng });

        try {
          const address = await getAddressFromCoordinates(lat, lng);
          if (!address) throw new Error("Failed to fetch address");

          const formattedLocation = [
            [address.road, address.house_number].filter(Boolean).join(" "),
            address.town ?? address.city,
            address.country,
          ]
            .filter(Boolean)
            .join(", ");

          form.setValue("location", formattedLocation, {
            shouldValidate: true,
          });
        } catch (error) {
          console.error("Error resolving address:", error);
          toast.error("Unable to retrieve your location. Please try again.");
        } finally {
          setIsLocating(false);
        }
      },
      (error) => {
        console.error("Error obtaining location:", error);
        toast.error("Unable to retrieve your location. Please try again.");
        setIsLocating(false);
      },
    );
  };

  const onSearchPlaces = async () => {
    // This runs outside `handleSubmit`, so the resolver never sees it: validate
    // the fields it depends on explicitly rather than assuming the form did.
    const isValid = await form.trigger(["location", "radius"]);
    if (!isValid || !coords) {
      if (!coords) toast.error("Please share your location first.");
      return;
    }

    const radiusMeters = RADIUS_OPTIONS.find(
      (option) => option.label === form.getValues("radius"),
    )?.meters;

    if (!radiusMeters) {
      form.setError("radius", {
        type: "manual",
        message: "Radius is required",
      });
      return;
    }

    setIsSearching(true);
    try {
      const result = await getGoogleNearbyPlaces(
        coords.lat,
        coords.lng,
        radiusMeters,
      );

      if (!result.success) {
        toast.error(result.message);
        return;
      }

      if (result.places.length === 0) {
        toast.error("No places found in the specified radius.");
        return;
      }

      setAvailablePlaces(result.places);
      form.setValue("selectedPlaces", [], { shouldValidate: false });
    } finally {
      setIsSearching(false);
    }
  };

  const onSubmit = async (data: LiveGuideFormValues) => {
    if (!coords) {
      toast.error("User location is missing.");
      return;
    }

    const radiusMeters = RADIUS_OPTIONS.find(
      (option) => option.label === data.radius,
    )?.meters;

    if (!radiusMeters) {
      form.setError("radius", {
        type: "manual",
        message: "Radius is required",
      });
      return;
    }

    const sortedPlaces = [...(data.selectedPlaces as MappedPlace[])].sort(
      (a, b) => (a.distance ?? 0) - (b.distance ?? 0),
    );

    const generatedUrl = buildDirectionsUrl(coords, sortedPlaces);

    setIsSaving(true);
    try {
      const res = await saveLiveGuideRoute({
        location: data.location,
        coords,
        radiusNumber: radiusMeters,
        selectedPlaces: sortedPlaces,
        mapLink: generatedUrl,
      });

      if (!res.success) {
        toast.error(res.message);
        return;
      }

      setGoogleMapsUrl(generatedUrl);
      toast.success("Route created successfully!");
      setOpen(true);
    } finally {
      setIsSaving(false);
    }
  };

  const togglePlaceById = (
    place: MappedPlace,
    field: ControllerRenderProps<LiveGuideFormValues, "selectedPlaces">,
  ) => {
    const current = field.value ?? [];
    const exists = current.some((item) => item.id === place.id);

    if (!exists && current.length >= MAX_SELECTED_PLACES) {
      toast.error(`You can select at most ${MAX_SELECTED_PLACES} places.`);
      return;
    }

    field.onChange(
      exists
        ? current.filter((item) => item.id !== place.id)
        : [...current, place],
    );
  };

  const hasResults = availablePlaces.length > 0;

  return (
    <div className="w-full flex justify-center items-center">
      <Card className="w-full max-w-125 md:max-w-175 main-card pr-0! pl-0!">
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="flex flex-col gap-4 md:flex-row md:gap-5">
                <div className="flex flex-col w-full md:w-[50%]">
                  <FormField
                    control={form.control}
                    name="location"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="mb-2 font-medium">
                          Location
                        </FormLabel>
                        <FormControl>
                          <Input
                            className="h-11 text-base md:text-base lg:h-9 lg:text-sm"
                            placeholder={
                              isLocating
                                ? "Loading location..."
                                : "Your location"
                            }
                            readOnly
                            {...field}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>

                <div className="flex flex-col w-full md:w-[20%]">
                  <FormField
                    control={form.control}
                    name="radius"
                    render={() => (
                      <FormItem className="flex flex-col">
                        <FormLabel className="mb-2 font-medium">
                          Radius
                        </FormLabel>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <FormControl>
                              <Button
                                type="button"
                                variant="outline"
                                className={cn(
                                  "h-11 w-full lg:h-9",
                                  radiusValue
                                    ? "text-foreground"
                                    : "text-gray-500",
                                )}
                              >
                                {radiusValue || "Select Radius"}
                              </Button>
                            </FormControl>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="center">
                            <DropdownMenuLabel>
                              Select a radius
                            </DropdownMenuLabel>
                            <DropdownMenuGroup>
                              {RADIUS_OPTIONS.map((option) => (
                                <DropdownMenuItem
                                  key={option.label}
                                  onSelect={() =>
                                    form.setValue("radius", option.label, {
                                      shouldValidate: true,
                                    })
                                  }
                                >
                                  {option.label}
                                </DropdownMenuItem>
                              ))}
                            </DropdownMenuGroup>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </FormItem>
                    )}
                  />
                </div>

                <div className="flex flex-col justify-end w-full md:w-auto">
                  <div className="mb-2 hidden md:block">
                    <Label className="opacity-0">Spacer</Label>
                  </div>
                  <Button
                    variant="outline"
                    className="text-gray-500 cursor-pointer h-11 lg:h-9"
                    type="button"
                    onClick={handleUserLocation}
                    disabled={isLocating}
                  >
                    {isLocating ? "Loading..." : "Use Current Location"}
                  </Button>
                </div>
              </div>

              <div className="flex flex-wrap gap-x-4 justify-between text-sm mt-2 text-gray-500">
                <div>Found {availablePlaces.length} places</div>
                <div>
                  Selected {selectedCount}/{MAX_SELECTED_PLACES} places
                </div>
              </div>

              <div>
                <Controller
                  control={form.control}
                  name="selectedPlaces"
                  render={({ field }) => (
                    <FormItem>
                      <div className="mb-4">
                        <FormLabel className="text-base">Places</FormLabel>
                        <FormDescription>
                          {hasResults
                            ? "Select the places you want to visit."
                            : "Fill in the fields and click 'Find Places' to see results."}
                        </FormDescription>
                      </div>
                      <div className="flex flex-col gap-2">
                        {availablePlaces.map((place) => {
                          const isSelected = field.value?.some(
                            (item) => item.id === place.id,
                          );
                          return (
                            <div
                              key={place.id}
                              role="checkbox"
                              aria-checked={Boolean(isSelected)}
                              tabIndex={0}
                              className={cn(
                                "flex items-start space-x-3 rounded-lg border p-3 shadow-sm main-card w-full",
                                "cursor-pointer transition-all duration-150 ease-out",
                                "hover:bg-accent/50 hover:scale-[1.01]",
                                "active:scale-[0.99]",
                                isSelected
                                  ? "border-primary bg-primary/5"
                                  : "border-gray-200",
                              )}
                              onClick={() => togglePlaceById(place, field)}
                              onKeyDown={(event) => {
                                if (
                                  event.key === "Enter" ||
                                  event.key === " "
                                ) {
                                  event.preventDefault();
                                  togglePlaceById(place, field);
                                }
                              }}
                            >
                              <div
                                className={cn(
                                  "h-4 w-4 rounded border flex items-center justify-center shrink-0 mt-1",
                                  isSelected
                                    ? "bg-primary border-primary"
                                    : "border-muted",
                                )}
                              >
                                {isSelected && (
                                  <Check className="h-3 w-3 text-white" />
                                )}
                              </div>

                              <div className="space-y-1 leading-none w-full min-w-0">
                                <div className="flex items-start justify-between gap-2">
                                  <div className="flex flex-col min-w-0 flex-1">
                                    <span className="text-base font-semibold truncate pr-1 text-wrap">
                                      {place.name}
                                    </span>
                                    <span className="text-sm lg:text-xs text-muted-foreground truncate font-normal text-wrap">
                                      {place.address.split(",")[0]}
                                      {place.distance != null &&
                                        ` • ${place.distance} km`}
                                    </span>
                                  </div>

                                  <Badge
                                    variant="secondary"
                                    className="text-xs font-normal shrink-0"
                                  >
                                    {place.category}
                                  </Badge>
                                </div>

                                <div className="flex items-center gap-3 text-sm text-muted-foreground mt-1.5">
                                  <div className="flex items-center gap-1 text-amber-500 font-medium shrink-0">
                                    <Star className="h-3.5 w-3.5 fill-current" />
                                    <span>{place.rating}</span>
                                    <span className="text-gray-400 font-normal">
                                      ({place.userRatingCount})
                                    </span>
                                  </div>

                                  {place.distance != null && (
                                    <div className="flex items-center gap-1 shrink-0">
                                      <MapPin className="h-3.5 w-3.5" />
                                      <span>{place.distance} km</span>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </FormItem>
                  )}
                />
              </div>

              {Object.keys(errors).length > 0 && (
                <div className="rounded-md bg-destructive/15 p-3 text-sm text-destructive dark:bg-destructive/20">
                  <div className="flex items-center gap-2 font-medium">
                    <AlertCircle className="h-4 w-4" />
                    Please fix the following errors:
                  </div>
                  <ul className="mt-2 list-inside list-disc opacity-90">
                    {Object.entries(errors).map(([key, error]) => (
                      <li key={key}>{error?.message}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Two explicit buttons rather than one whose `type` flips between
                  "button" and "submit" depending on component state. */}
              <div className="flex flex-col gap-2 sm:flex-row">
                <Button
                  type="button"
                  variant={hasResults ? "outline" : "default"}
                  onClick={onSearchPlaces}
                  disabled={isSearching || isLocating}
                  className="w-full cursor-pointer h-11 lg:h-9"
                >
                  {isSearching
                    ? "Searching..."
                    : hasResults
                      ? "Search again"
                      : "Find Places"}
                </Button>

                {hasResults && (
                  <Button
                    type="submit"
                    disabled={isSaving || selectedCount === 0}
                    className="w-full cursor-pointer h-11 lg:h-9"
                  >
                    {isSaving
                      ? "Saving..."
                      : "Open a google maps with the route"}
                  </Button>
                )}
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
      <MyModal open={open} setOpen={setOpen} googleMapsUrl={googleMapsUrl} />
    </div>
  );
};

export default LiveGuideForm;
