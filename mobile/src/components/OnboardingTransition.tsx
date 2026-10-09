import {ReactNode, useLayoutEffect, useRef, useState} from "react";
import {Animated, Easing, Platform, StyleSheet, View} from "react-native";

import {useReducedMotion} from "./Motion";

type Props = {step: string; children: ReactNode};

/** Crossfade steps while keeping only the current step interactive and accessible. */
export function OnboardingTransition({step, children}: Props) {
  const progress = useRef(new Animated.Value(1)).current;
  const last = useRef({step, children});
  const [outgoing, setOutgoing] = useState<{children: ReactNode} | null>(null);
  const reduceMotion = useReducedMotion();

  useLayoutEffect(() => {
    if (last.current.step === step || reduceMotion) {
      progress.setValue(1);
      setOutgoing(null);
      return;
    }
    setOutgoing({children: last.current.children});
    progress.setValue(0);
    const animation = Animated.timing(progress, {
      toValue: 1, duration: 280, easing: Easing.out(Easing.cubic), useNativeDriver: Platform.OS !== "web",
    });
    animation.start(({finished}) => {if (finished) setOutgoing(null);});
    return () => animation.stop();
  }, [step, reduceMotion, progress]);

  useLayoutEffect(() => {last.current = {step, children};});

  return <View style={styles.container}>
    {outgoing ? <Animated.View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants"
      aria-hidden={true} style={[styles.outgoing, {
        opacity: progress.interpolate({inputRange: [0, 1], outputRange: [1, 0]}),
        transform: [{translateY: progress.interpolate({inputRange: [0, 1], outputRange: [0, -16]})}],
      }]}>{outgoing.children}</Animated.View> : null}
    <Animated.View style={{opacity: progress, transform: [{translateY: progress.interpolate({inputRange: [0, 1], outputRange: [20, 0]})}]}}>
      {children}
    </Animated.View>
  </View>;
}

const styles = StyleSheet.create({container: {position: "relative"}, outgoing: {position: "absolute", top: 0, left: 0, right: 0}});
