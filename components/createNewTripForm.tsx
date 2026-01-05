"use client";

import { insertTripSchema } from "@/lib/validators";
import { useState } from "react";
import { Form, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import z from "zod";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "./ui/form";
import { Input } from "./ui/input";
const CreateNewTripForm = () => {
  const [step, setStep] = useState(1);
  const form = useForm<z.infer<typeof insertTripSchema>>({
    resolver: zodResolver(insertTripSchema),
  });
  return (
    <Form {...form}>
      <form
        className="space-y-8"
        onSubmit={form.handleSubmit((data) => console.log(data))}
      >
        <FormField
          control={form.control}
          name="destination"
          render={({ field }) => (
            <FormItem>
              <FormLabel>UserName</FormLabel>
              <FormControl>
                <Input placeholder="Destination" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </form>
    </Form>
  );
};

export default CreateNewTripForm;
