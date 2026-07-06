import { PropsWithChildren } from "react";
import { SafeAreaView, ScrollView, StyleSheet, Text, View } from "react-native";

export function Screen({ children, title }: PropsWithChildren<{ title: string }>) {
  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>{title}</Text>
        <View style={styles.body}>{children}</View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#f7f3ec",
  },
  content: {
    padding: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    color: "#3f2f24",
    marginBottom: 16,
  },
  body: {
    gap: 12,
  },
});
