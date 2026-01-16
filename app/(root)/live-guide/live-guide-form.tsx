/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
  DropdownMenu,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
} from "@/components/ui/form";
import {
  AlertCircle,
  Camera,
  Check,
  Landmark,
  MapPin,
  Star,
  TreePine,
  Utensils,
} from "lucide-react";
import { toast } from "sonner";
import { formSchema } from "@/lib/validators";
import { useState } from "react";
import { getGoogleNearbyPlaces } from "@/lib/google-maps-api";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { saveLiveGuideRoute } from "@/lib/actions/live-guide";
import { MyModal } from "@/components/utils/my-dialog";

const LiveGuideForm = ({ userId }: { userId: string }) => {
  const form = useForm<any>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      location: "",
      radius: "",
      selectedPlaces: [],
    },
  });

  const radiusValue = form.watch("radius");

  const radiusOptions = [
    "1 km",
    "3 km",
    "5 km",
    "10 km",
    "20 km",
    "30 km and more",
  ];

  const { errors } = form.formState;
  const [googleMapsUrl, setGoogleMapsUrl] = useState("");
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(
    null
  );
  const [availalablePlaces, setAvailalablePlaces] = useState<any[]>([]);
  const [isPending, setIsPending] = useState(false);

  const handleUserLocation = async () => {
    if (!navigator.geolocation) {
      alert("Geolocation is not supported by your browser"); // Change later to modal
      return;
    }
    setIsPending(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        setCoords({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        try {
          const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&accept-language=en`
          );

          if (!response.ok) throw new Error("Failed to fetch address");

          const data = await response.json();
          const addr = data.address;

          const formattedLocation = `${addr.road || ""} ${
            addr.house_number || ""
          } ${addr.town || ""}, ${addr.country || ""}`;

          form.setValue("location", formattedLocation);
          if (form.formState.errors.location) {
            form.clearErrors("location");
          }
        } catch (error) {
          console.error("Error:", error);
          toast.error("Unable to retrieve your location. Please try again.");
        } finally {
          setIsPending(false);
        }
      },
      (error) => {
        console.error("Error obtaining location:", error);
        setIsPending(false);
      }
    );
  };

  // implement later
  const getCategoryIcon = (category: string) => {
    const cat = category.toLowerCase();
    if (
      cat.includes("restaurant") ||
      cat.includes("food") ||
      cat.includes("cafe")
    )
      return <Utensils className="h-5 w-5 text-orange-500" />;
    if (cat.includes("park") || cat.includes("nature"))
      return <TreePine className="h-5 w-5 text-green-500" />;
    if (cat.includes("museum") || cat.includes("history"))
      return <Landmark className="h-5 w-5 text-blue-500" />;
    return <Camera className="h-5 w-5 text-indigo-500" />;
  };

  const onSearchPlaces = async () => {
    const currentLoc = form.getValues("location");
    const currentRadius = form.getValues("radius");

    if (!currentLoc || !coords) {
      toast.error("Please share your location first.");
      form.setError("location", {
        type: "manual",
        message: "Location is required.",
      });
      return;
    }

    const radiusNumber = Number(currentRadius.split(" ")[0]) * 1000;

    const places = await getGoogleNearbyPlaces(
      coords.lat,
      coords.lng,
      radiusNumber
    );
    if (places.length === 0) {
      toast.error("No places found in the specified radius.");
      form.setError("places", {
        type: "manual",
        message: "Radius is required.",
      });
      return;
    }
    setAvailalablePlaces(places);
    console.log("Places found:", places);
  };

  const onSubmit = async (data: any) => {
    const selected = data.selectedPlaces;

    // 1. Validation
    if (selected.length < 1 || selected.length > 10) {
      toast.error("Please select between 1 and 10 places.");
      return;
    }
    if (!coords) {
      toast.error("User location is missing.");
      return;
    }

    const sortedPlaces = [...selected].sort(
      (a: any, b: any) => a.distance - b.distance
    );

    const lastPlace = sortedPlaces[sortedPlaces.length - 1];
    const waypoints = sortedPlaces.slice(0, sortedPlaces.length - 1);

    const originStr = `${coords.lat},${coords.lng}`;
    const destStr = `${lastPlace.location.lat},${lastPlace.location.lng}`;

    const waypointsStr = waypoints
      .map((p: any) => `${p.location.lat},${p.location.lng}`)
      .join("|");

    const generatedUrl = `https://www.google.com/maps/dir/?api=1&origin=${originStr}&destination=${destStr}&waypoints=${waypointsStr}&travelmode=driving`;
    setGoogleMapsUrl(generatedUrl);
    const res = await saveLiveGuideRoute(userId, {
      location: data.location,
      coords: coords,
      radiusNumber: Number(data.radius.split(" ")[0]) * 1000,
      selectedPlaces: sortedPlaces,
      mapLink: generatedUrl,
    });
    if (res.success) {
      toast.success("Route created successfully!");
      setOpen(true);
    } else {
      toast.error(res.error || "Failed to save the route.");
    }
  };

  const togglePlaceById = (place: any, field: any) => {
    const current = field.value ?? [];
    const exists = current.some((p: any) => p.id === place.id);

    field.onChange(
      exists
        ? current.filter((p: any) => p.id !== place.id)
        : [...current, place]
    );
  };

  const se = form.watch("selectedPlaces")?.length || 0;
  return (
    <div className="w-full h-full flex justify-center items-center ">
      <Card className="w-125 md:w-175 main-card pr-0! pl-0!">
        <CardContent>
          {/* 4. Wrap everything in the Form component */}
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="flex flex-row gap-5">
                {/* LOCATION FIELD */}
                <div className="flex flex-col w-[50%]">
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
                            placeholder={
                              isPending
                                ? "Loading location..."
                                : "Your location"
                            }
                            disabled={true}
                            {...field}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>

                {/* RADIUS FIELD (Custom Dropdown Integration) */}
                <div className="flex flex-col w-[20%]">
                  <FormField
                    control={form.control}
                    name="radius"
                    render={({}) => (
                      <FormItem className="flex flex-col">
                        <FormLabel className="mb-2 font-medium">
                          Radius
                        </FormLabel>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <FormControl>
                              <Button
                                variant="outline"
                                className={
                                  radiusValue
                                    ? "text-foreground"
                                    : "text-gray-500"
                                }
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
                              {radiusOptions.map((option) => (
                                <DropdownMenuItem
                                  key={option}
                                  onSelect={() => {
                                    form.setValue("radius", option, {
                                      shouldValidate: true,
                                    });
                                    if (form.formState.errors.radius) {
                                      form.clearErrors("radius");
                                    }
                                  }}
                                >
                                  {option}
                                </DropdownMenuItem>
                              ))}
                            </DropdownMenuGroup>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </FormItem>
                    )}
                  />
                </div>

                {/* SHARE LOCATION BUTTON */}
                <div className="flex flex-col justify-end">
                  {/* This is kept as a standard button, not a submit button */}
                  <div className="mb-2 hidden md:block">
                    <Label className="opacity-0">Spacer</Label>
                  </div>
                  <Button
                    variant="outline"
                    className="text-gray-500 cursor-pointer"
                    type="button" // Prevent submitting the form
                    onClick={handleUserLocation}
                  >
                    {isPending ? "Loading..." : "Use Current Location"}
                  </Button>
                </div>
              </div>

              <div className="flex justify-between text-sm mt-2 text-gray-500">
                <div>Found {availalablePlaces.length} places</div>
                <div>Selected {se}/10 places</div>
              </div>

              {/*Checkboxes area*/}
              <div>
                <Controller
                  control={form.control}
                  name="selectedPlaces"
                  render={({ field }) => (
                    <FormItem>
                      <div className="mb-4">
                        <FormLabel className="text-base">Places</FormLabel>
                        <FormDescription>
                          {availalablePlaces.length === 0
                            ? "Fill in the fields and click 'Find Places' to see results."
                            : "Select the places you want to visit."}
                        </FormDescription>
                      </div>
                      <div className="flex flex-col gap-2">
                        {availalablePlaces.map((place) => {
                          const isSelected = field.value?.some(
                            (item: any) => item.id === place.id
                          );
                          return (
                            <div
                              className={cn(
                                "flex items-start space-x-3 rounded-lg border p-3 shadow-sm main-card",
                                "cursor-pointer transition-all duration-150 ease-out",
                                "hover:bg-accent/50 hover:scale-[1.01]",
                                "active:scale-[0.99]",
                                isSelected
                                  ? "border-primary bg-primary/5"
                                  : "border-gray-200"
                              )}
                              key={place.id}
                              onClick={() => togglePlaceById(place, field)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter" || e.key === " ") {
                                  e.preventDefault();
                                  togglePlaceById(place, field);
                                }
                              }}
                            >
                              <div
                                className={cn(
                                  "h-4 w-4 rounded border flex items-center justify-center",
                                  isSelected
                                    ? "bg-primary border-primary"
                                    : "border-muted"
                                )}
                              >
                                {isSelected && (
                                  <Check className="h-3 w-3 text-white" />
                                )}
                              </div>

                              <div className="space-y-1 leading-none w-full">
                                {/* Row 1: Name and Badge */}
                                <div className="flex items-center justify-between">
                                  <div className="flex flex-col min-w-0">
                                    {" "}
                                    <FormLabel className="text-base font-semibold cursor-pointer truncate">
                                      {place.name}
                                    </FormLabel>
                                    <span className="text-xs text-muted-foreground truncate font-normal">
                                      {place.address.split(",")[0]}{" "}
                                      {place.distance &&
                                        `• ${place.distance} km`}
                                    </span>
                                  </div>
                                  <Badge
                                    variant="secondary"
                                    className="text-xs font-normal"
                                  >
                                    {place.category}
                                  </Badge>
                                </div>

                                {/* Row 2: Rating and Details */}
                                <div className="flex items-center gap-3 text-sm text-muted-foreground mt-1.5">
                                  <div className="flex items-center gap-1 text-amber-500 font-medium">
                                    <Star className="h-3.5 w-3.5 fill-current" />
                                    <span>{place.rating}</span>
                                    <span className="text-gray-400 font-normal">
                                      ({place.userRatingCount || 0})
                                    </span>
                                  </div>

                                  {place.distance && (
                                    <div className="flex items-center gap-1">
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

              {/*Errors block*/}
              {Object.keys(errors).length > 0 && (
                <div className="rounded-md bg-destructive/15 p-3 text-sm text-destructive dark:bg-destructive/20">
                  <div className="flex items-center gap-2 font-medium">
                    <AlertCircle className="h-4 w-4" />
                    Please fix the following errors:
                  </div>
                  <ul className="mt-2 list-inside list-disc opacity-90">
                    {Object.entries(errors).map(
                      ([key, error]: [string, any]) => (
                        <li key={key}>
                          {/* Display the message from the error object */}
                          {error.message}
                        </li>
                      )
                    )}
                  </ul>
                </div>
              )}
              {/* Added a submit button to test the form */}
              <Button
                type={availalablePlaces.length === 0 ? "button" : "submit"}
                onClick={
                  availalablePlaces.length === 0 ? onSearchPlaces : undefined
                }
                disabled={isPending}
                className="w-full cursor-pointer"
              >
                {availalablePlaces.length === 0
                  ? "Find Places"
                  : "Open a google maps with the route"}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
      <MyModal open={open} setOpen={setOpen} googleMapsUrl={googleMapsUrl} />
    </div>
  );
};

export default LiveGuideForm;
