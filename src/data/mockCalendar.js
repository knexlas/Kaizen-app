/**
 * Mock calendar events for the upcoming week.
 * Used by Sunday Ritual and related planning UI.
 */

const getNextWeekDates = () => {
  const dates = [];
  const start = new Date();
  start.setDate(start.getDate() + (7 - start.getDay()));
  start.setHours(0, 0, 0, 0);
  for (let i = 0; i < 7; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    dates.push(d);
  }
  return dates;
};

const [mon, tue, wed, thu, fri, sat, sun] = getNextWeekDates();

export const mockEvents = [
  { id: '1', title: 'Quarterly Review', type: 'work', defaultWeather: 'storm', date: mon, time: '10:00' },
  { id: '2', title: 'Team Sync', type: 'work', defaultWeather: 'storm', date: mon, time: '14:00' },
  { id: '3', title: 'Gym Leg Day', type: 'health', defaultWeather: 'cloud', date: tue, time: '07:00' },
  { id: '4', title: 'Lunch with Alex', type: 'personal', defaultWeather: 'sun', date: tue, time: '12:30' },
  { id: '5', title: 'Deadline: Report', type: 'work', defaultWeather: 'storm', date: wed, time: '17:00' },
  { id: '6', title: 'Coffee Chat', type: 'personal', defaultWeather: 'sun', date: wed, time: '09:00' },
  { id: '7', title: 'Date Night', type: 'personal', defaultWeather: 'sun', date: thu, time: '19:00' },
  { id: '8', title: '1:1 Review', type: 'work', defaultWeather: 'storm', date: fri, time: '11:00' },
  { id: '9', title: 'Yoga', type: 'health', defaultWeather: 'cloud', date: sat, time: '10:00' },
  { id: '10', title: 'Meal Prep', type: 'personal', defaultWeather: 'cloud', date: sun, time: '14:00' },
];
