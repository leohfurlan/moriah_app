import { PropsWithChildren, useEffect, useRef, useState } from "react";
import { AccessibilityInfo, Animated, Platform, ViewProps } from "react-native";

export function useReducedMotion() {
  const [reduced, setReduced] = useState(() => Platform.OS === "web" && typeof window !== "undefined" ? window.matchMedia("(prefers-reduced-motion: reduce)").matches : true);
  useEffect(() => {
    let active = true;
    AccessibilityInfo.isReduceMotionEnabled().then(value => { if (active) setReduced(value); }).catch(() => {});
    const subscription = AccessibilityInfo.addEventListener("reduceMotionChanged", setReduced);
    return () => { active = false; subscription.remove(); };
  }, []);
  return reduced;
}

export function MotionView({children, style, ...props}: PropsWithChildren<ViewProps>) {
  const reduced = useReducedMotion();
  const progress = useRef(new Animated.Value(reduced ? 1 : 0)).current;
  useEffect(() => {
    if (reduced) { progress.setValue(1); return; }
    progress.setValue(0);
    const animation = Animated.timing(progress, {toValue: 1, duration: 180, useNativeDriver: Platform.OS !== "web"});
    animation.start();
    return () => animation.stop();
  }, [reduced, progress]);
  return <Animated.View {...props} style={[style, {opacity: progress, transform: [{translateY: progress.interpolate({inputRange:[0,1],outputRange:[8,0]})}]}]}>{children}</Animated.View>;
}
