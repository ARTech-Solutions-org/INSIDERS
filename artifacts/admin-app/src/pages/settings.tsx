import React, { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useGetRatingConfig, useUpdateRatingConfig, getGetRatingConfigQueryKey } from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Loader2, Settings2, Save, AlertTriangle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

const formSchema = z.object({
  clientRatingWeight: z.coerce.number().min(0).max(1),
  punctualityWeight: z.coerce.number().min(0).max(1),
  reliabilityWeight: z.coerce.number().min(0).max(1),
  gracePeriodMinutes: z.coerce.number().min(0),
  punctualityPenaltyPerInterval: z.coerce.number().min(0),
  punctualityIntervalMinutes: z.coerce.number().min(1),
  reliabilityWindowDays: z.coerce.number().min(1),
  noShowPenalty: z.coerce.number().min(0),
  lateCancellationPenalty: z.coerce.number().min(0),
  lateCancellationWindowHours: z.coerce.number().min(0),
  reliabilityFlagThreshold: z.coerce.number().min(1),
}).refine((data) => {
  const sum = data.clientRatingWeight + data.punctualityWeight + data.reliabilityWeight;
  return Math.abs(sum - 1) < 0.01;
}, {
  message: "The sum of the three weights must equal exactly 1.0",
  path: ["clientRatingWeight"], // attach error to one of the fields
});

export default function Settings() {
  const { data: config, isLoading } = useGetRatingConfig();
  const { mutateAsync: updateConfig, isPending: isUpdating } = useUpdateRatingConfig();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      clientRatingWeight: 0.5,
      punctualityWeight: 0.3,
      reliabilityWeight: 0.2,
      gracePeriodMinutes: 10,
      punctualityPenaltyPerInterval: 0.5,
      punctualityIntervalMinutes: 10,
      reliabilityWindowDays: 30,
      noShowPenalty: 1.0,
      lateCancellationPenalty: 0.5,
      lateCancellationWindowHours: 24,
      reliabilityFlagThreshold: 3,
    },
  });

  useEffect(() => {
    if (config) {
      form.reset({
        clientRatingWeight: config.clientRatingWeight || 0.5,
        punctualityWeight: config.punctualityWeight || 0.3,
        reliabilityWeight: config.reliabilityWeight || 0.2,
        gracePeriodMinutes: config.gracePeriodMinutes || 10,
        punctualityPenaltyPerInterval: config.punctualityPenaltyPerInterval || 0.5,
        punctualityIntervalMinutes: config.punctualityIntervalMinutes || 10,
        reliabilityWindowDays: config.reliabilityWindowDays || 30,
        noShowPenalty: config.noShowPenalty || 1.0,
        lateCancellationPenalty: config.lateCancellationPenalty || 0.5,
        lateCancellationWindowHours: config.lateCancellationWindowHours || 24,
        reliabilityFlagThreshold: config.reliabilityFlagThreshold || 3,
      });
    }
  }, [config, form]);

  async function onSubmit(values: z.infer<typeof formSchema>) {
    try {
      await updateConfig({ data: values });
      queryClient.invalidateQueries({ queryKey: getGetRatingConfigQueryKey() });
      toast({
        title: "Settings Saved",
        description: "Rating engine configuration has been updated and a background recalculation was triggered.",
      });
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: err.response?.data?.error || "Failed to update configuration",
      });
    }
  }

  const { clientRatingWeight, punctualityWeight, reliabilityWeight } = form.watch();
  const sum = (clientRatingWeight || 0) + (punctualityWeight || 0) + (reliabilityWeight || 0);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
      <div className="flex items-center justify-between space-y-2">
        <h2 className="text-3xl font-bold tracking-tight">System Settings</h2>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            
            {/* Weights Configuration */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings2 className="h-5 w-5" />
                  Composite Rating Weights
                </CardTitle>
                <CardDescription>
                  Configure how the 3 factors combine into the usher's overall score.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Alert variant={Math.abs(sum - 1) > 0.01 ? "destructive" : "default"}>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>Total Weight: {(sum * 100).toFixed(0)}%</AlertTitle>
                  <AlertDescription>
                    Weights must exactly equal 1.0 (100%).
                  </AlertDescription>
                </Alert>

                <FormField
                  control={form.control}
                  name="clientRatingWeight"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Client Rating Weight (e.g., 0.5)</FormLabel>
                      <FormControl>
                        <Input type="number" step="0.01" {...field} />
                      </FormControl>
                      <FormDescription>Weight of the average client stars (0-5 scale).</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="punctualityWeight"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Punctuality Weight (e.g., 0.3)</FormLabel>
                      <FormControl>
                        <Input type="number" step="0.01" {...field} />
                      </FormControl>
                      <FormDescription>Weight of the check-in time adherence.</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="reliabilityWeight"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Reliability Weight (e.g., 0.2)</FormLabel>
                      <FormControl>
                        <Input type="number" step="0.01" {...field} />
                      </FormControl>
                      <FormDescription>Weight of absences and cancellations.</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            {/* Punctuality Details */}
            <Card>
              <CardHeader>
                <CardTitle>Punctuality Configuration</CardTitle>
                <CardDescription>Rules for deducting points for late check-ins.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField
                  control={form.control}
                  name="gracePeriodMinutes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Grace Period (minutes)</FormLabel>
                      <FormControl>
                        <Input type="number" {...field} />
                      </FormControl>
                      <FormDescription>Time allowed before penalties start.</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="punctualityPenaltyPerInterval"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Penalty</FormLabel>
                        <FormControl>
                          <Input type="number" step="0.1" {...field} />
                        </FormControl>
                        <FormDescription>Points lost</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="punctualityIntervalMinutes"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Per Interval (minutes)</FormLabel>
                        <FormControl>
                          <Input type="number" {...field} />
                        </FormControl>
                        <FormDescription>Block of time</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Reliability Details */}
            <Card className="md:col-span-2">
              <CardHeader>
                <CardTitle>Reliability & Cancellations</CardTitle>
                <CardDescription>Rules for no-shows and late cancellations.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-6 md:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="noShowPenalty"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>No-Show Penalty</FormLabel>
                        <FormControl>
                          <Input type="number" step="0.1" {...field} />
                        </FormControl>
                        <FormDescription>Points deducted for a missed event.</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="lateCancellationPenalty"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Late Cancel Penalty</FormLabel>
                          <FormControl>
                            <Input type="number" step="0.1" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="lateCancellationWindowHours"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Window (Hours)</FormLabel>
                          <FormControl>
                            <Input type="number" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="reliabilityWindowDays"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Lookback Window (Days)</FormLabel>
                        <FormControl>
                          <Input type="number" {...field} />
                        </FormControl>
                        <FormDescription>How far back to count incidents.</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="reliabilityFlagThreshold"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Auto-Flag Threshold</FormLabel>
                        <FormControl>
                          <Input type="number" {...field} />
                        </FormControl>
                        <FormDescription>Number of incidents within the lookback window before an usher is flagged.</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </CardContent>
            </Card>

          </div>

          <div className="flex justify-end">
            <Button type="submit" disabled={isUpdating}>
              {isUpdating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              <Save className="mr-2 h-4 w-4" />
              Save Configuration
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
