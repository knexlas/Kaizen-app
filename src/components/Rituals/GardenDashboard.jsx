/**
 * Daily action dashboard. Receives weeklyPlan from the Sunday Ritual.
 * Placeholder until full dashboard is built.
 */
function GardenDashboard({ weeklyPlan }) {
  const hasPlan = weeklyPlan?.events?.length > 0;
  const todayIndex = new Date().getDay() - 1; // 0 = Mon, 6 = Sun (simplified)
  const todayWeather = weeklyPlan?.weeklyWeather?.[todayIndex] ?? 'leaf';

  return (
    <div className="min-h-screen bg-stone-50 p-6">
      <div className="max-w-2xl mx-auto">
        <h1 className="font-serif text-stone-900 text-2xl mb-2">Garden Dashboard</h1>
        <p className="font-sans text-stone-600 text-sm mb-6">
          Daily action view. Today&apos;s weather from your plan: <strong>{todayWeather}</strong>
        </p>
        {!hasPlan && (
          <p className="font-sans text-stone-500 text-sm">No weekly plan yet. Complete the Sunday Ritual first.</p>
        )}
        {hasPlan && (
          <p className="font-sans text-stone-600 text-sm">
            Plan saved with {weeklyPlan.events.length} events.
          </p>
        )}
      </div>
    </div>
  );
}

export default GardenDashboard;
