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
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Checkbox } from "@/components/ui/checkbox";
import { AlertCircle } from "lucide-react";
import { toast } from "sonner";

const formSchema = z.object({
  location: z
    .string()
    .min(1, {
      message: "Choose a location by clicking a Use Current Location button",
    }),
  radius: z.string().min(1, { message: "Radius is required" }),
  selectedPlaces: z
    .array(
      z.object({
        id: z.string(),
        label: z.string(),
        category: z.string(),
        rating: z.number(),
      })
    )
    .min(1, { message: "Select at least one place to visit" }),
});

const LiveGuideForm = () => {
  const form = useForm<any>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      location: "",
      radius: "",
      selectedPlaces: [],
    },
  });

  const radiusValue = form.watch("radius");

  const onSubmit = (data: any) => {
    console.log("Form Data:", data);
  };

  const places = [
    { id: "eiffel", label: "Eiffel Tower", category: "Tourism", rating: 4.8 },
    { id: "louvre", label: "Louvre Museum", category: "Museum", rating: 4.7 },
    { id: "arc", label: "Arc de Triomphe", category: "Tourism", rating: 4.6 },
  ];

  const radiusOptions = ["1 km", "3 km", "5 km", "10 km", "20 km", "30+ km"];

  const { errors } = form.formState;

  const handleUserLocation = async () => {
    if (!navigator.geolocation) {
      alert("Geolocation is not supported by your browser"); // Change later to modal
      return;
    }
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;

        try {
          const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&accept-language=en`
          );

          if (!response.ok) throw new Error("Failed to fetch address");

          const data = await response.json();
          const addr = data.address;

          const formattedLocation = `${addr.road || ""} ${
            addr.house_number || ""
          } ${addr.town || ""}, ${addr.country || ""}`;

          form.setValue("location", formattedLocation);
        } catch (error) {
          console.error("Error:", error);
          toast.error("Unable to retrieve your location. Please try again.");
        } finally {
          //setIsLoadingLocation(false);
        }
      },
      (error) => {
        console.error("Error obtaining location:", error);
      }
    );
  };
  return (
    <div className="w-full h-full flex justify-center items-center">
      <Card className="w-125 md:w-175">
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
                            placeholder="Your location"
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
                    render={({ field }) => (
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
                                    form.setValue("radius", option);
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
                    Use Current Location
                  </Button>
                </div>
              </div>

              <div className="flex justify-between text-sm mt-2 text-gray-500">
                <div>Found 20 places</div>
                <div>Selected 8/10 places</div>
              </div>

              {/*Checkboxes area*/}
              <div>
                <FormField
                  control={form.control}
                  name="selectedPlaces"
                  render={({ field }) => (
                    <FormItem>
                      <div className="mb-4">
                        <FormLabel className="text-base">Places</FormLabel>
                        <FormDescription>
                          Select the places you want to visit.
                        </FormDescription>
                      </div>
                      <div className="flex flex-col gap-2">
                        {places.map((place) => (
                          <div
                            className="flex-row flex items-start space-x-3 space-y-0"
                            key={place.id}
                          >
                            <FormControl>
                              <Checkbox
                                checked={field.value?.some(
                                  (item: any) => item.id === place.id
                                )}
                                onCheckedChange={(checked) => {
                                  return checked
                                    ? field.onChange([
                                        ...(field.value || []),
                                        place,
                                      ])
                                    : field.onChange(
                                        (field.value || []).filter(
                                          (item: any) => item.id !== place.id
                                        )
                                      );
                                }}
                              />
                            </FormControl>
                            <FormLabel className="font-normal ">
                              {place.label} {place.category} {place.rating}
                            </FormLabel>
                          </div>
                        ))}
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
              <Button type="submit" className="w-full mt-4">
                Find Places
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
};

export default LiveGuideForm;
