import { DayView } from "@/components/day/day-view";
import { loadDay } from "@/lib/day-data";
import { localDay } from "@/lib/time";
import { getTz, requestNow } from "@/lib/tz";

export default async function TodayPage() {
  const tz = await getTz();
  const now = await requestNow();
  const data = await loadDay(tz, localDay(tz, new Date(now)));
  return <DayView key={data.day} data={data} tz={tz} isToday serverNow={now} />;
}
