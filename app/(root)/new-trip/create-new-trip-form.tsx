"use client";

import { insertTripSchema } from "@/lib/validators";
import { BUDGET_RANGE, INTERESTS_LIST } from "@/lib/variables";
import { zodResolver } from "@hookform/resolvers/zod";
import { format } from "date-fns";
import { useForm, useWatch, FieldErrors } from "react-hook-form";
import z from "zod";

import { insertTrip } from "@/lib/actions/trip.actions";
import { cn } from "@/lib/utils";
import { ArrowRightLeft, CalendarIcon } from "lucide-react";
import { redirect } from "next/navigation";
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

const CreateNewTripForm = () => {
  const form = useForm<z.infer<typeof insertTripSchema>>({
    resolver: zodResolver(insertTripSchema),
    defaultValues: {
      destination: "",
      country: "",
      interests: [],
      budget: [BUDGET_RANGE[0], BUDGET_RANGE[1]],
    },
  });
  const startDate = useWatch({ control: form.control, name: "startDate" });
  const endDate = useWatch({ control: form.control, name: "endDate" });
  const destination = useWatch({ control: form.control, name: "destination" });
  const onError = (errors: FieldErrors<z.infer<typeof insertTripSchema>>) => {
    toast.error("Please fill in all required fields correctly.");
  };

  const [isPending, startTransition] = useTransition();
  const onSubmit = (data: z.infer<typeof insertTripSchema>) => {
    startTransition(async () => {
      const res = await insertTrip(data);

      if (!res.success) {
        toast.error(res.message);
        return;
      }

      toast.success(res.message);
      form.reset();
      redirect(`/trip/${res.tripId}`);
    });
  };

  return (
    <>
      <Form {...form}>
        <form
          className="space-y-8 flex flex-col justify-center   h-full"
          onSubmit={form.handleSubmit(onSubmit, onError)}
        >
          <h1 className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 text-[24px] text-left w-full">
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
                  <Input placeholder="Destination" {...field} />
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
                  <Input placeholder="Country" {...field} />
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
                <div className="flex flex-col sm:flex-row items-center gap-4 cursor-pointer w-full pt-1">
                  {/*  (Start Date) */}
                  <div className="relative w-full">
                    <Button
                      type="button"
                      variant={"outline"}
                      className={cn(
                        "w-full justify-start text-left font-normal border-slate-600 hover:border-cyan-400 transition-colors",
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
                  <div className="text-slate-400">
                    <ArrowRightLeft size={20} />
                  </div>

                  {/*  (End Date) */}
                  <div className="relative w-full">
                    <Button
                      type="button"
                      variant={"outline"}
                      className={cn(
                        "w-full justify-start text-left font-normal border-slate-600 hover:border-cyan-400 transition-colors",
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
                    form.setValue("startDate", range?.from as Date);
                    form.setValue("endDate", range?.to as Date);

                    if (range?.from && range?.to) {
                      form.trigger(["startDate", "endDate"]);
                    }
                  }}
                  numberOfMonths={2}
                  disabled={(date) => date < new Date(new Date())}
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
                        className="rounded-full px-5 py-3 border-slate-600 text-slate-400 
                                      data-[state=on]:bg-cyan-500/20 
                                      data-[state=on]:border-cyan-400 
                                      data-[state=on]:text-cyan-400 
                                      hover:bg-slate-800 hover:text-white cursor-pointer"
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
                      className="py-4"
                    />
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/*BUTTONS SECTION*/}
          <div className="main-card flex max-md:justify-center justify-end ">
            <Button
              type="submit"
              className="bg-cyan-400 text-black hover:bg-cyan-500 font-semibold min-w-25 max-sm:w-[90%] max-sm:text-wrap"
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
