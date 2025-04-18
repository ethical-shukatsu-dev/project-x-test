'use client';

import {
  MetricCard,
  ConversionFunnel,
  SplitMetric,
  RefreshButton,
  ABTestComparison,
} from './DashboardCards';
import { SurveyStepsFunnel } from './SurveyStepsFunnel';
import { useAnalytics } from '@/hooks/useAnalytics';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { RefreshCw } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useState } from 'react';
import { TimeRange, DateRange } from '@/types/analytics';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { format } from 'date-fns';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { formatInTimeZone } from 'date-fns-tz';

const timeRangeLabels: Record<TimeRange, string> = {
  '24h': 'Last 24 Hours',
  '7d': 'Last 7 Days',
  '30d': 'Last 30 Days',
  all: 'All Time',
  custom: 'Custom Range',
};

export function AnalyticsDashboard() {
  const { data, loading, error, timeRange, dateRange, changeTimeRange, refreshData } =
    useAnalytics();
  const [refreshingStates, setRefreshingStates] = useState<Record<string, boolean>>({
    visitors: false,
    surveyStarted: false,
    surveyCompleted: false,
    signups: false,
    surveyFunnel: false,
    surveyTypes: false,
    signupMethods: false,
    uniqueSignups: false,
    recommendations: false,
    surveySteps: false,
    dropoffAnalysis: false,
    anonymousUsers: false,
    abTestComparison: false,
    dialogCloses: false,
    all: false,
  });

  // Date picker state
  const [startDate, setStartDate] = useState<Date | null>(
    new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
  );
  const [endDate, setEndDate] = useState<Date | null>(new Date());
  const [dialogOpen, setDialogOpen] = useState(false);

  // Custom date formatter for JST
  const formatDateJST = (date: Date) => {
    return formatInTimeZone(date, 'Asia/Tokyo', 'MMM d, yyyy');
  };

  const refreshMetric = async (metricKey: string) => {
    // Set the specific metric loading state
    setRefreshingStates((prev) => ({ ...prev, [metricKey]: true }));

    // Refresh only the specific metric
    await refreshData(timeRange, metricKey);

    // Reset loading state after a short delay for visual feedback
    setTimeout(() => {
      setRefreshingStates((prev) => ({ ...prev, [metricKey]: false }));
    }, 500);
  };

  const refreshAllMetrics = async () => {
    setRefreshingStates((prev) => ({ ...prev, all: true }));
    await refreshData();
    setTimeout(() => {
      setRefreshingStates((prev) => ({ ...prev, all: false }));
    }, 500);
  };

  // Apply custom date range
  const applyDateRange = () => {
    if (startDate && endDate) {
      const customDateRange: DateRange = {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
      };
      changeTimeRange('custom', customDateRange);
      setDialogOpen(false);
    }
  };

  // Format date for display
  const formatDateRange = () => {
    if (timeRange === 'custom' && dateRange) {
      const start = new Date(dateRange.startDate);
      const end = new Date(dateRange.endDate);
      return `${formatInTimeZone(start, 'Asia/Tokyo', 'MMM d, yyyy')} - ${formatInTimeZone(end, 'Asia/Tokyo', 'MMM d, yyyy')}`;
    }
    return timeRangeLabels[timeRange];
  };

  if (error) {
    return (
      <Card className="border-red-300">
        <CardHeader>
          <CardTitle className="text-red-500">Error Loading Analytics</CardTitle>
        </CardHeader>
        <CardContent>
          <p>{error.message}</p>
          <button
            className="mt-4 px-4 py-2 bg-primary text-primary-foreground rounded-md"
            onClick={() => refreshAllMetrics()}
          >
            Retry
          </button>
        </CardContent>
      </Card>
    );
  }

  // Only show the full skeleton if initial loading or all metrics are refreshing
  if ((loading && !data) || refreshingStates.all) {
    return <DashboardSkeleton />;
  }

  // Create a default stats object with empty values for type safety
  const defaultStats = {
    totalEvents: 0,
    signupClicks: 0,
    dialogCloses: 0,
    uniqueDialogCloses: 0,
    dialogCloseConversionRate: '0%',
    conversionRate: '0%',
    surveyFunnel: {
      visits: 0,
      uniqueUsers: 0,
      started: 0,
      completed: 0,
      startRate: '0%',
      completionRate: '0%',
      overallConversionRate: '0%',
      anonymousStarts: 0,
      nonAnonymousStarts: 0,
    },
    surveyTypes: {
      text: 0,
      image: 0,
      total: 0,
    },
    recommendations: {
      pageVisits: 0,
      companyInterestClicks: 0,
      companyInterestRate: '0%',
      averageCompaniesPerUser: 0,
      uniqueCompanyInterests: 0,
      anonymousInterests: 0,
      nonAnonymousInterests: 0,
    },
    signups: {
      emailSignups: 0,
      googleSignups: 0,
      totalSignups: 0,
      uniqueEmailSignups: 0,
      uniqueGoogleSignups: 0,
      uniqueTotalSignups: 0,
      anonymousEmailSignups: 0,
      nonAnonymousEmailSignups: 0,
      anonymousGoogleSignups: 0,
      nonAnonymousGoogleSignups: 0,
      anonymousTotalSignups: 0,
      nonAnonymousTotalSignups: 0,
    },
    surveySteps: [],
    dropoffAnalysis: [],
    anonymousUsers: {
      total: 0,
      percentage: '0%',
      conversionRate: '0%',
      completionRate: '0%',
    },
    abTestComparison: {
      anonymous: {
        total: 0,
        percentage: '0%',
        completionRate: '0%',
        conversionRate: '0%',
      },
      nonAnonymous: {
        total: 0,
        percentage: '0%',
        completionRate: '0%',
        conversionRate: '0%',
      },
      difference: {
        completionRate: '0%',
        conversionRate: '0%',
      },
    },
  };

  // Use the data if available, otherwise use default values
  const stats = data ? data.stats : defaultStats;

  // Process survey step data for display
  const surveySteps = stats.surveySteps || [];

  // Define the question order to match the order in ValuesQuestionnaire.tsx
  const questionOrder = [
    'work_values',
    'corporate_culture',
    'leadership',
    'workplace_environment',
    'humanity',
    'interpersonal_skills',
    'cognitive_abilities',
    'self_growth',
    'job_performance',
    'mental_strength',
  ];

  // Map and sort the steps based on the defined order
  const stepsWithLabels = surveySteps
    .map((step) => {
      // Parse the step ID to create a readable label
      const stepName = step.id
        .split('_')
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');

      // Find the index in the question order array (or default to a high number if not found)
      const orderIndex = questionOrder.indexOf(step.id);

      return {
        ...step,
        label: stepName,
        orderIndex: orderIndex >= 0 ? orderIndex : 999,
      };
    })
    .sort((a, b) => a.orderIndex - b.orderIndex)
    .map((step, index) => ({
      ...step,
      // Add the step number to the label
      label: `${index + 1}. ${step.label}`,
    }));

  // Get dropoff analysis data
  // const dropoffData = stats.dropoffAnalysis || [];

  // Apply the same ordering to dropoff analysis data
  // const orderedDropoffData = dropoffData
  //   .map((item) => {
  //     // Find the index in the question order array (or default to a high number if not found)
  //     const orderIndex = questionOrder.indexOf(item.id);

  //     return {
  //       ...item,
  //       orderIndex: orderIndex >= 0 ? orderIndex : 999,
  //     };
  //   })
  //   .sort((a, b) => a.orderIndex - b.orderIndex)
  //   .map((item, index) => ({
  //     ...item,
  //     // Add the step number to the label
  //     label: `${index + 1}. ${item.label}`,
  //   }));

  // Render individual metric cards with conditionally showing skeletons when refreshing
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Analytics Dashboard</h2>

        <div className="flex gap-2 items-center">
          <Button
            variant="outline"
            size="sm"
            className="flex items-center gap-1"
            onClick={refreshAllMetrics}
            disabled={refreshingStates.all}
          >
            <RefreshCw className={`h-4 w-4 ${refreshingStates.all ? 'animate-spin' : ''}`} />
            Refresh All
          </Button>

          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <Tabs defaultValue={timeRange}>
              <TabsList>
                {(Object.keys(timeRangeLabels) as TimeRange[]).map((range) => {
                  if (range === 'custom') {
                    return (
                      <DialogTrigger key={range} asChild>
                        <TabsTrigger value={range} data-state={timeRange === range ? 'active' : ''}>
                          {timeRange === 'custom' ? formatDateRange() : timeRangeLabels[range]}
                        </TabsTrigger>
                      </DialogTrigger>
                    );
                  }

                  return (
                    <TabsTrigger
                      key={range}
                      value={range}
                      onClick={() => changeTimeRange(range)}
                      data-state={timeRange === range ? 'active' : ''}
                    >
                      {timeRangeLabels[range]}
                    </TabsTrigger>
                  );
                })}
              </TabsList>
            </Tabs>

            <DialogContent>
              <DialogHeader>
                <DialogTitle>Select Date Range</DialogTitle>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Start Date</label>
                    <DatePicker
                      selected={startDate}
                      onChange={(date: Date | null) => setStartDate(date)}
                      selectsStart
                      startDate={startDate || undefined}
                      endDate={endDate || undefined}
                      maxDate={new Date()}
                      className="w-full border rounded-md p-2"
                      dateFormat="MMM d, yyyy"
                      customInput={
                        <input
                          className="w-full border rounded-md p-2"
                          value={startDate ? formatDateJST(startDate) : ''}
                        />
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">End Date</label>
                    <DatePicker
                      selected={endDate}
                      onChange={(date: Date | null) => setEndDate(date)}
                      selectsEnd
                      startDate={startDate || undefined}
                      endDate={endDate || undefined}
                      minDate={startDate || undefined}
                      maxDate={new Date()}
                      className="w-full border rounded-md p-2"
                      dateFormat="MMM d, yyyy"
                      customInput={
                        <input
                          className="w-full border rounded-md p-2"
                          value={endDate ? formatDateJST(endDate) : ''}
                        />
                      }
                    />
                  </div>
                </div>
                <Button onClick={applyDateRange} className="w-full">
                  Apply Range
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Visitors */}
        {refreshingStates.visitors ? (
          <MetricCardSkeleton />
        ) : (
          <MetricCard
            title="Unique Visitors"
            value={stats.surveyFunnel.uniqueUsers}
            description="Total unique users"
            onRefresh={() => refreshMetric('visitors')}
          />
        )}

        {/* Survey Started */}
        {refreshingStates.surveyStarted ? (
          <MetricCardSkeleton />
        ) : (
          <MetricCard
            title="Survey Started"
            value={stats.surveyFunnel.started}
            description="Users who started the questionnaire"
            onRefresh={() => refreshMetric('surveyStarted')}
          />
        )}

        {/* Survey Completed */}
        {refreshingStates.surveyCompleted ? (
          <MetricCardSkeleton />
        ) : (
          <MetricCard
            title="Survey Completed"
            value={stats.surveyFunnel.completed}
            description="Users who completed the questionnaire"
            onRefresh={() => refreshMetric('surveyCompleted')}
          />
        )}

        {/* Signups */}
        {refreshingStates.uniqueSignups ? (
          <MetricCardSkeleton />
        ) : (
          <MetricCard
            title="Signups"
            value={stats.signups.uniqueTotalSignups}
            description="Total unique account signups"
            onRefresh={() => refreshMetric('uniqueSignups')}
          />
        )}
      </div>

      {/* Unique Dialog Closes Card */}
      {refreshingStates.dialogCloses ? (
        <Card>
          <CardHeader>
            <Skeleton className="h-5 w-32" />
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Skeleton className="h-6 w-48 mb-2" />
              <Skeleton className="h-4 w-64" />
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <CardTitle className="text-sm font-medium">Signup Dialog Metrics</CardTitle>
              <RefreshButton onClick={() => refreshMetric('dialogCloses')} />
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 bg-muted/50 rounded-lg">
                <h3 className="text-sm font-medium mb-2">Dialog Closes</h3>
                <div className="flex justify-between items-center">
                  <span className="text-sm">Total</span>
                  <span className="font-medium">{stats.dialogCloses}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm">Unique</span>
                  <span className="font-medium">{stats.uniqueDialogCloses}</span>
                </div>
              </div>
              <div className="p-4 bg-muted/50 rounded-lg">
                <h3 className="text-sm font-medium mb-2">Conversion Rate</h3>
                <div className="flex justify-between items-center">
                  <span className="text-sm">Rate</span>
                  <span className="font-medium">{stats.dialogCloseConversionRate}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm">From Unique Visitors</span>
                  <span className="text-xs text-muted-foreground">
                    {stats.uniqueDialogCloses} / {stats.surveyFunnel.uniqueUsers}
                  </span>
                </div>
              </div>
              <div className="p-4 bg-muted/50 rounded-lg">
                <h3 className="text-sm font-medium mb-2">Impact</h3>
                <div className="text-xs text-muted-foreground mb-2">
                  Users who close the signup dialog without completing registration
                </div>
                {stats.dialogCloseConversionRate}
                <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary"
                    style={{
                      width: `${Math.min(100, parseInt(stats.dialogCloseConversionRate))}%`,
                    }}
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Conversion Funnel */}
        {refreshingStates.surveyFunnel ? (
          <ConversionFunnelSkeleton />
        ) : (
          <ConversionFunnel
            title="Questionnaire Funnel"
            steps={[
              {
                name: 'Visits',
                value: stats.surveyFunnel.uniqueUsers,
              },
              {
                name: 'Started',
                value: stats.surveyFunnel.started,
                breakdown: {
                  anonymous: stats.surveyFunnel.anonymousStarts,
                  nonAnonymous: stats.surveyFunnel.nonAnonymousStarts,
                },
              },
              {
                name: 'Completed',
                value: stats.surveyFunnel.completed,
              },
            ]}
            rates={[
              { name: 'Start Rate', value: stats.surveyFunnel.startRate },
              {
                name: 'Completion Rate',
                value: stats.surveyFunnel.completionRate,
              },
              {
                name: 'Overall',
                value: stats.surveyFunnel.overallConversionRate,
              },
            ]}
            onRefresh={() => refreshMetric('surveyFunnel')}
          />
        )}

        {/* Survey Types */}
        {refreshingStates.surveyTypes ? (
          <MetricCardSkeleton />
        ) : (
          <SplitMetric
            title="Questionnaire Types"
            metrics={[
              { name: 'Text Based', value: stats.surveyTypes.text },
              { name: 'Image Based', value: stats.surveyTypes.image },
            ]}
            total={stats.surveyTypes.total}
            onRefresh={() => refreshMetric('surveyTypes')}
          />
        )}
      </div>

      {/* A/B Test Comparison */}
      {refreshingStates.abTestComparison ? (
        <Card className="col-span-1 md:col-span-3">
          <CardHeader>
            <Skeleton className="h-6 w-48 mb-2" />
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {Array(3)
                .fill(0)
                .map((_, i) => (
                  <Card key={i} className="bg-muted/50">
                    <CardHeader>
                      <Skeleton className="h-4 w-32 mb-1" />
                      <Skeleton className="h-3 w-24" />
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        {Array(2)
                          .fill(0)
                          .map((_, j) => (
                            <div key={j}>
                              <div className="flex justify-between mb-1">
                                <Skeleton className="h-3 w-24" />
                                <Skeleton className="h-3 w-12" />
                              </div>
                              <Skeleton className="h-2 w-full" />
                            </div>
                          ))}
                      </div>
                    </CardContent>
                  </Card>
                ))}
            </div>
          </CardContent>
        </Card>
      ) : (
        <ABTestComparison
          title="A/B Test Results: Anonymous Mode"
          description="Comparison of anonymous vs non-anonymous user behavior"
          data={stats.abTestComparison}
          onRefresh={() => refreshMetric('abTestComparison')}
        />
      )}

      {/* Unique Signup Metrics */}
      {refreshingStates.uniqueSignups ? (
        <MetricCardSkeleton />
      ) : (
        <Card className="mt-4">
          <CardHeader>
            <div className="flex justify-between items-center">
              <CardTitle className="text-sm font-medium">Unique Signup Clicks</CardTitle>
              <RefreshButton onClick={() => refreshMetric('uniqueSignups')} />
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 bg-muted/50 rounded-lg">
                <h3 className="text-sm font-medium mb-2">Email Signups</h3>
                <div className="flex justify-between items-center">
                  <span className="text-sm">Total</span>
                  <span className="font-medium">{stats.signups.emailSignups}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm">Unique</span>
                  <span className="font-medium">{stats.signups.uniqueEmailSignups}</span>
                </div>
                <div className="mt-2 pt-2 border-t border-border">
                  <h4 className="text-xs font-medium mb-1">Unique User Breakdown</h4>
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-muted-foreground">Anonymous Users</span>
                    <span className="text-xs font-medium">
                      {stats.signups.anonymousEmailSignups}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-muted-foreground">Non-Anonymous Users</span>
                    <span className="text-xs font-medium">
                      {stats.signups.nonAnonymousEmailSignups}
                    </span>
                  </div>
                </div>
              </div>
              <div className="p-4 bg-muted/50 rounded-lg">
                <h3 className="text-sm font-medium mb-2">Google Signups</h3>
                <div className="flex justify-between items-center">
                  <span className="text-sm">Total</span>
                  <span className="font-medium">{stats.signups.googleSignups}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm">Unique</span>
                  <span className="font-medium">{stats.signups.uniqueGoogleSignups}</span>
                </div>
                <div className="mt-2 pt-2 border-t border-border">
                  <h4 className="text-xs font-medium mb-1">Unique User Breakdown</h4>
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-muted-foreground">Anonymous Users</span>
                    <span className="text-xs font-medium">
                      {stats.signups.anonymousGoogleSignups}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-muted-foreground">Non-Anonymous Users</span>
                    <span className="text-xs font-medium">
                      {stats.signups.nonAnonymousGoogleSignups}
                    </span>
                  </div>
                </div>
              </div>
              <div className="p-4 bg-muted/50 rounded-lg">
                <h3 className="text-sm font-medium mb-2">Total Signups</h3>
                <div className="flex justify-between items-center">
                  <span className="text-sm">Total</span>
                  <span className="font-medium">{stats.signups.totalSignups}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm">Unique</span>
                  <span className="font-medium">{stats.signups.uniqueTotalSignups}</span>
                </div>
                <div className="mt-2 pt-2 border-t border-border">
                  <h4 className="text-xs font-medium mb-1">Unique User Breakdown</h4>
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-muted-foreground">Anonymous Users</span>
                    <span className="text-xs font-medium">
                      {stats.signups.anonymousTotalSignups}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-muted-foreground">Non-Anonymous Users</span>
                    <span className="text-xs font-medium">
                      {stats.signups.nonAnonymousTotalSignups}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Survey Steps Funnel */}
      {refreshingStates.surveySteps ? (
        <SurveyStepsFunnelSkeleton />
      ) : (
        <SurveyStepsFunnel
          title="Survey Step Completion"
          steps={stepsWithLabels}
          totalStarts={stats.surveyFunnel.started}
          onRefresh={() => refreshMetric('surveySteps')}
        />
      )}

      {/* Dropoff Analysis */}
      {/* {refreshingStates.dropoffAnalysis ? (
        <DropoffAnalysisSkeleton />
      ) : (
        <DropoffAnalysis
          title="Drop-off Analysis"
          description="Detailed analysis of where users abandon the survey"
          data={orderedDropoffData}
          onRefresh={() => refreshMetric("dropoffAnalysis")}
        />
      )} */}

      {/* Recommendations Metrics */}
      {refreshingStates.recommendations ? (
        <MetricCardSkeleton />
      ) : (
        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <CardTitle className="text-sm font-medium">Recommendations</CardTitle>
              <RefreshButton onClick={() => refreshMetric('recommendations')} />
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm">Page Visits</span>
                  <span className="font-medium">{stats.recommendations.pageVisits}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm">Interest Clicks</span>
                  <span className="font-medium">{stats.recommendations.companyInterestClicks}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm">Interest Clicks Unique Users</span>
                  <span className="font-medium">
                    {stats.recommendations.uniqueCompanyInterests}
                  </span>
                </div>
              </div>

              {/* Interest Breakdown */}
              <div className="pt-2 border-t">
                <h4 className="text-sm font-medium mb-2">Interest Breakdown</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-2 bg-muted/50 rounded-lg text-center">
                    <div className="text-sm font-medium">
                      {stats.recommendations.anonymousInterests}
                    </div>
                    <div className="text-xs text-muted-foreground">Anonymous Users</div>
                  </div>
                  <div className="p-2 bg-muted/50 rounded-lg text-center">
                    <div className="text-sm font-medium">
                      {stats.recommendations.nonAnonymousInterests}
                    </div>
                    <div className="text-xs text-muted-foreground">Non-Anonymous Users</div>
                  </div>
                </div>
              </div>

              <div className="space-y-2 pt-2 border-t">
                <div className="flex justify-between items-center">
                  <span className="text-sm">Rate of Users who Clicked Interest</span>
                  <span className="font-medium">{stats.recommendations.companyInterestRate}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm">Avg. Companies/User</span>
                  <span className="font-medium">
                    {stats.recommendations.averageCompaniesPerUser}
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// Individual skeleton components for each section

function MetricCardSkeleton() {
  return (
    <Card>
      <CardHeader className="pb-2">
        <Skeleton className="h-5 w-32" />
      </CardHeader>
      <CardContent>
        <Skeleton className="h-8 w-24 mb-2" />
        <Skeleton className="h-4 w-40" />
      </CardContent>
    </Card>
  );
}

function ConversionFunnelSkeleton() {
  return (
    <Card className="col-span-2">
      <CardHeader>
        <Skeleton className="h-6 w-48 mb-2" />
        <Skeleton className="h-4 w-64" />
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            {Array(3)
              .fill(0)
              .map((_, i) => (
                <div key={i} className="text-center">
                  <Skeleton className="h-6 w-16 mx-auto mb-2" />
                  <Skeleton className="h-4 w-24 mx-auto" />
                </div>
              ))}
          </div>
          <Skeleton className="h-4 w-full" />
          <div className="grid grid-cols-3 gap-4">
            {Array(3)
              .fill(0)
              .map((_, i) => (
                <div key={i} className="text-center">
                  <Skeleton className="h-6 w-16 mx-auto mb-2" />
                  <Skeleton className="h-4 w-24 mx-auto" />
                </div>
              ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function SurveyStepsFunnelSkeleton() {
  return (
    <Card className="col-span-3">
      <CardHeader>
        <Skeleton className="h-6 w-60 mb-2" />
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {Array(5)
            .fill(0)
            .map((_, i) => (
              <div key={i} className="space-y-2">
                <div className="flex justify-between">
                  <Skeleton className="h-5 w-40" />
                  <div className="flex gap-2">
                    <Skeleton className="h-5 w-10" />
                    <Skeleton className="h-5 w-16" />
                  </div>
                </div>
                <Skeleton className="h-2 w-full" />
              </div>
            ))}
        </div>
      </CardContent>
    </Card>
  );
}

function DropoffAnalysisSkeleton() {
  return (
    <Card className="col-span-3">
      <CardHeader>
        <div>
          <Skeleton className="h-6 w-48 mb-2" />
          <Skeleton className="h-4 w-96" />
        </div>
      </CardHeader>
      <CardContent>
        <Skeleton className="h-8 w-96 mb-4" />
        <Skeleton className="h-[300px] w-full mb-6" />

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {Array(3)
            .fill(0)
            .map((_, i) => (
              <Card key={i} className="bg-muted/50">
                <CardHeader className="p-3 pb-0">
                  <Skeleton className="h-5 w-24" />
                </CardHeader>
                <CardContent className="p-3 pt-0">
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <Skeleton className="h-4 w-16" />
                      <Skeleton className="h-4 w-12" />
                    </div>
                    <div className="flex justify-between">
                      <Skeleton className="h-4 w-16" />
                      <Skeleton className="h-4 w-12" />
                    </div>
                    <div className="flex justify-between">
                      <Skeleton className="h-4 w-16" />
                      <Skeleton className="h-4 w-12" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
        </div>
      </CardContent>
    </Card>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-10 w-96" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array(4)
          .fill(0)
          .map((_, i) => (
            <MetricCardSkeleton key={i} />
          ))}
      </div>

      {/* Dialog Closes Card Skeleton */}
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-48" />
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {Array(3)
              .fill(0)
              .map((_, i) => (
                <div key={i} className="p-4 bg-muted/50 rounded-lg">
                  <Skeleton className="h-5 w-32 mb-2" />
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <Skeleton className="h-4 w-16" />
                      <Skeleton className="h-4 w-12" />
                    </div>
                    <div className="flex justify-between items-center">
                      <Skeleton className="h-4 w-16" />
                      <Skeleton className="h-4 w-12" />
                    </div>
                    {/* Add breakdown section skeleton */}
                    <div className="mt-2 pt-2 border-t border-border">
                      <Skeleton className="h-4 w-24 mb-1" />
                      <div className="flex justify-between items-center">
                        <Skeleton className="h-3 w-20" />
                        <Skeleton className="h-3 w-10" />
                      </div>
                      <div className="flex justify-between items-center">
                        <Skeleton className="h-3 w-20" />
                        <Skeleton className="h-3 w-10" />
                      </div>
                    </div>
                  </div>
                </div>
              ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <ConversionFunnelSkeleton />

        {Array(2)
          .fill(0)
          .map((_, i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-6 w-36 mb-2" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-40 w-full" />
              </CardContent>
            </Card>
          ))}
      </div>

      {/* A/B Test Comparison Skeleton */}
      <Card className="col-span-1 md:col-span-3">
        <CardHeader>
          <Skeleton className="h-6 w-48 mb-2" />
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {Array(3)
              .fill(0)
              .map((_, i) => (
                <Card key={i} className="bg-muted/50">
                  <CardHeader>
                    <Skeleton className="h-4 w-32 mb-1" />
                    <Skeleton className="h-3 w-24" />
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {Array(2)
                        .fill(0)
                        .map((_, j) => (
                          <div key={j}>
                            <div className="flex justify-between mb-1">
                              <Skeleton className="h-3 w-24" />
                              <Skeleton className="h-3 w-12" />
                            </div>
                            <Skeleton className="h-2 w-full" />
                          </div>
                        ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
          </div>
        </CardContent>
      </Card>

      <SurveyStepsFunnelSkeleton />
      <DropoffAnalysisSkeleton />

      {/* Anonymous Users Card Skeleton */}
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-48" />
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {Array(3)
              .fill(0)
              .map((_, i) => (
                <div key={i} className="p-4 bg-muted/50 rounded-lg">
                  <Skeleton className="h-5 w-32 mb-2" />
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <Skeleton className="h-4 w-16" />
                      <Skeleton className="h-4 w-12" />
                    </div>
                    <div className="flex justify-between items-center">
                      <Skeleton className="h-4 w-16" />
                      <Skeleton className="h-4 w-12" />
                    </div>
                    {/* Add breakdown section skeleton */}
                    <div className="mt-2 pt-2 border-t border-border">
                      <Skeleton className="h-4 w-24 mb-1" />
                      <div className="flex justify-between items-center">
                        <Skeleton className="h-3 w-20" />
                        <Skeleton className="h-3 w-10" />
                      </div>
                      <div className="flex justify-between items-center">
                        <Skeleton className="h-3 w-20" />
                        <Skeleton className="h-3 w-10" />
                      </div>
                    </div>
                  </div>
                </div>
              ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
