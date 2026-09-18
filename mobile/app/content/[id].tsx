import { useLocalSearchParams } from "expo-router";
import { ContentScreen } from "@/screens/ContentScreen";

export default function ContentDetailPage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <ContentScreen id={id} />;
}
