import { ComponentProps, PropsWithChildren } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

export function Field(props: ComponentProps<typeof TextInput>) {
  return <TextInput placeholderTextColor="#87786c" style={styles.input} {...props} />;
}

export function Button({
  children,
  disabled = false,
  onPress,
  variant = "primary",
}: PropsWithChildren<{ disabled?: boolean; onPress?: () => void; variant?: "primary" | "secondary" }>) {
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={[styles.button, variant === "secondary" && styles.secondaryButton, disabled && styles.disabledButton]}
    >
      <Text style={[styles.buttonText, variant === "secondary" && styles.secondaryButtonText, disabled && styles.disabledButtonText]}>
        {children}
      </Text>
    </Pressable>
  );
}

export function Card({ children }: PropsWithChildren) {
  return <View style={styles.card}>{children}</View>;
}

const styles = StyleSheet.create({
  input: {
    borderWidth: 1,
    borderColor: "#d6cbbb",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: "#fffdf9",
  },
  button: {
    backgroundColor: "#7a4d2d",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
  },
  secondaryButton: {
    backgroundColor: "#efe4d7",
  },
  disabledButton: {
    opacity: 0.55,
  },
  buttonText: {
    color: "#fff",
    fontWeight: "700",
  },
  secondaryButtonText: {
    color: "#6b4c37",
  },
  disabledButtonText: {
    color: "#f5efe7",
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    gap: 8,
    borderWidth: 1,
    borderColor: "#eadfce",
  },
});
