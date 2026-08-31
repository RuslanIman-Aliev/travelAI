"use client";

import { insertTripSchema } from "@/lib/validators";
import { BUDGET_RANGE, INTERESTS_LIST } from "@/lib/variables";
import { zodResolver } from "@hookform/resolvers/zod";
import { format } from "date-fns";
import { useForm, useWatch, type FieldErrors } from "react-hook-form";
import z from "zod";

import { insertTrip } from "@/lib/actions/trip.actions";
import { localDayToUtcDate } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { ArrowRightLeft, CalendarIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "../../../components/ui/button";
import { Calendar } from "../../../components/ui/calendar";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "../../../components/ui/form";
import { Input } from "../../../components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "../../../components/ui/popover";
import { Slider } from "../../../components/ui/slider";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "../../../components/ui/toggle-group";

/** What each field is called on screen, so an error can name it. */
const FIELD_LABELS = {
  destination: "Destination",
  country: "Country",
  startDate: "Start date",
  endDate: "End date",
  interests: "Interests",
  budget: "Budget",
} as const;

/** Midnight today, so the current day stays selectable in the date picker. */
const startOfToday = () => {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return now;
};

const CreateNewTripForm = () => {
  const today = startOfToday();
  const form = useForm<z.infer<typeof insertTripSchema>>({
    resolver: zodResolver(insertTripSchema),
    defaultValues: {
      destination: "",
      country: "",
      interests: [],
      budget: [BUDGET_RANGE[0], BUDGET_RANGE[1]],
    },
  });
  const router = useRouter();
  const startDate = useWatch({ control: form.control, name: "startDate" });
  const endDate = useWatch({ control: form.control, name: "endDate" });
  const destination = useWatch({ control: form.control, name: "destination" });

  /**
   * Names the fields that failed rather than saying "some field did".
   *
   * The form has six inputs and the old message pointed at none of them, so
   * finding the problem meant reading the whole form. `handleSubmit` already
   * focuses the first invalid field; this says what to look for once there.
   */
  const onError = (errors: FieldErrors<z.infer<typeof insertTripSchema>>) => {
    const invalid = (
      Object.keys(errors) as Array<keyof typeof FIELD_LABELS>
    ).filter((field) => field in FIELD_LABELS);

    if (invalid.length === 0) {
      toast.error("Please fill in all required fields correctly.");
      return;
    }

    // The first field's own message is the specific one - "End date must be on
    // or after the start date" beats repeating the field name back.
    const firstMessage = errors[invalid[0]]?.message;

    toast.error(
      invalid.length === 1
        ? `${FIELD_LABELS[invalid[0]]}: ${firstMessage ?? "check this field"}`
        : `Check these fields: ${invalid
            .map((field) => FIELD_LABELS[field])
            .join(", ")}`,
    );
  };

  const [isPending, startTransition] = useTransition();
  const onSubmit = (data: z.infer<typeof insertTripSchema>) => {
    startTransition(async () => {
      // The picker works in local time and the browser is the only place that
      // knows which calendar day the user actually clicked, so the conversion to
      // a date-only value has to happen here rather than in the action.
      const res = await insertTrip({
        ...data,
        startDate: localDayToUtcDate(data.startDate),
        endDate: localDayToUtcDate(data.endDate),
      });

      if (!res.success) {
        toast.error(res.message);
        return;
      }

      toast.success(res.message);
      router.push(`/trip/${res.tripId}`);
    });
  };

  return (
    <>
      <Form {...form}>
        <form
          className="space-y-8 flex flex-col justify-center   h-full"
          onSubmit={form.handleSubmit(onSubmit, onError)}
        >
          <h1 className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 text-xl sm:text-[24px] text-left w-full">
            Create Your New Journey
          </h1>
          <FormField
            control={form.control}
            name="destination"
            render={({ field }) => (
              <FormItem className="main-card">
                <FormLabel className="text-[20px]">
                  Where do you want to go?
                </FormLabel>
                <FormControl>
                  <Input
                    className="h-11 text-base md:text-base lg:h-9 lg:text-sm"
                    placeholder="Destination"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="country"
            render={({ field }) => (
              <FormItem className="main-card">
                <FormLabel className="text-[20px]">
                  Please enter the country you are visiting
                </FormLabel>
                <FormControl>
                  <Input
                    className="h-11 text-base md:text-base lg:h-9 lg:text-sm"
                    placeholder="Country"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="space-y-2 main-card">
            <div className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 text-[20px]  ">
              When are you traveling?
            </div>

            <Popover>
              <PopoverTrigger asChild>
                <div className="flex flex-col sm:flex-row items-center gap-3 sm:gap-4 cursor-pointer w-full pt-1">
                  {/*  (Start Date) */}
                  <div className="relative w-full">
                    <Button
                      type="button"
                      variant={"outline"}
                      className={cn(
                        "w-full h-11 lg:h-9 justify-start text-left font-normal border-slate-600 hover:border-cyan-400 transition-colors",
                        !startDate && "text-muted-foreground",
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {startDate ? (
                        format(startDate, "LLL dd, y")
                      ) : (
                        <span>Start Date</span>
                      )}
                    </Button>
                  </div>

                  {/* Arrow */}
                  <div className="text-muted-foreground">
                    <ArrowRightLeft size={20} />
                  </div>

                  {/*  (End Date) */}
                  <div className="relative w-full">
                    <Button
                      type="button"
                      variant={"outline"}
                      className={cn(
                        "w-full h-11 lg:h-9 justify-start text-left font-normal border-slate-600 hover:border-cyan-400 transition-colors",
                        !endDate && "text-muted-foreground",
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {endDate ? (
                        format(endDate, "LLL dd, y")
                      ) : (
                        <span>End Date</span>
                      )}
                    </Button>
                  </div>
                </div>
              </PopoverTrigger>

              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  initialFocus
                  mode="range"
                  defaultMonth={startDate}
                  selected={{ from: startDate, to: endDate }}
                  onSelect={(range) => {
                    // `range.from`/`range.to` really can be undefined mid-selection;
                    // let the resolver report that rather than casting it away.
                    if (range?.from) form.setValue("startDate", range.from);
                    if (range?.to) form.setValue("endDate", range.to);

                    if (range?.from && range?.to) {
                      form.trigger(["startDate", "endDate"]);
                    }
                  }}
                  numberOfMonths={2}
                  disabled={{ before: today }}
                />
              </PopoverContent>
            </Popover>

            {(form.formState.errors.startDate ||
              form.formState.errors.endDate) && (
              <p className="text-sm font-medium text-destructive">
                Please select a valid date range
              </p>
            )}
          </div>

          <FormField
            control={form.control}
            name="interests"
            render={({ field }) => (
              <FormItem className="main-card">
                <FormLabel className="text-[20px] mb-4 block">
                  Select Interests
                </FormLabel>
                <FormControl>
                  <ToggleGroup
                    type="multiple"
                    variant={"outline"}
                    size="lg"
                    onValueChange={field.onChange}
                    value={field.value}
                    spacing={20}
                    className="flex flex-wrap justify-center w-full "
                  >
                    {INTERESTS_LIST.map((interest) => (
                      <ToggleGroupItem
                        key={interest}
                        value={interest}
                        className="rounded-full px-5 py-3 min-h-11 lg:min-h-10 border-border text-muted-foreground
                                      data-[state=on]:bg-cyan-500/20
                                      data-[state=on]:border-cyan-500
                                      data-[state=on]:text-cyan-700
                                      dark:data-[state=on]:border-cyan-400
                                      dark:data-[state=on]:text-cyan-400
                                      hover:bg-accent hover:text-accent-foreground cursor-pointer"
                      >
                        {interest}
                      </ToggleGroupItem>
                    ))}
                  </ToggleGroup>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          {/*BUDGET SECTION*/}
          <FormField
            control={form.control}
            defaultValue={BUDGET_RANGE}
            name="budget"
            render={({ field }) => (
              <FormItem className="main-card">
                <FormLabel className="text-sm font-medium">
                  Budget (USD)
                </FormLabel>

                <FormControl>
                  <div className="space-y-4 pt-2">
                    <div className="flex justify-between text-sm font-bold">
                      <span>${field.value?.[0]}</span>
                      <span>${field.value?.[1]}</span>
                    </div>

                    <Slider
                      min={0}
                      max={10000}
                      step={100}
                      defaultValue={BUDGET_RANGE}
                      value={field.value}
                      onValueChange={field.onChange}
                      className="py-4 [&_[data-slot=slider-thumb]]:size-6 lg:[&_[data-slot=slider-thumb]]:size-4"
                    />
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/*BUTTONS SECTION*/}
          <div className="main-card flex justify-center md:justify-end">
            <Button
              type="submit"
              className="bg-cyan-400 text-black hover:bg-cyan-500 font-semibold w-[90%] h-auto min-h-11 py-2 whitespace-normal sm:w-auto lg:min-w-25 lg:min-h-9 sm:whitespace-nowrap"
              disabled={isPending}
            >
              {isPending ? "Generating a trip...." : "Generate trip"} to{" "}
              {destination ? destination : "your destination"}
            </Button>
          </div>
        </form>
      </Form>
    </>
  );
};

export default CreateNewTripForm;
