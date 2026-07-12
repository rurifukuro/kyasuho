// PinchImageViewer — ピンチズーム・パン・ダブルタップ対応の1枚画像ビューア。
// urehan（レジさぽっ！）正準から流用。Z-1〜Z-15 標準パターン準拠。
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Image, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, withDecay, cancelAnimation, clamp, runOnJS } from 'react-native-reanimated';

type Props = {
  uri: string;
  style?: StyleProp<ViewStyle>;
  onTap?: () => void;
  backgroundColor?: string;
};

const MAX_ZOOM = 6;
const PINCH_SENSITIVITY = 0.9;
const DOUBLE_TAP_ZOOM = 2;

export default function PinchImageViewer({ uri, style, onTap, backgroundColor = '#111' }: Props) {
  const scale = useSharedValue(1);
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const savedScale = useSharedValue(1);
  const savedTx = useSharedValue(0);
  const savedTy = useSharedValue(0);
  const savedFocalX = useSharedValue(0);
  const savedFocalY = useSharedValue(0);
  const vpW = useSharedValue(0);
  const vpH = useSharedValue(0);
  const [viewport, setViewport] = useState({ w: 0, h: 0 });

  useEffect(() => { vpW.value = viewport.w; vpH.value = viewport.h; }, [viewport.w, viewport.h, vpW, vpH]);

  const initRef = useRef<string>('');
  useEffect(() => {
    const key = `${uri}|${viewport.w}x${viewport.h}`;
    if (viewport.w === 0 || viewport.h === 0) return;
    if (initRef.current === key) return;
    initRef.current = key;
    scale.value = 1; tx.value = 0; ty.value = 0;
    savedScale.value = 1; savedTx.value = 0; savedTy.value = 0;
  }, [uri, viewport.w, viewport.h, scale, tx, ty, savedScale, savedTx, savedTy]);

  const clampOffsets = (s: number) => {
    'worklet';
    const cw = vpW.value * s;
    const ch = vpH.value * s;
    let minX: number, maxX: number;
    if (cw <= vpW.value) { minX = (vpW.value - cw) / 2; maxX = minX; }
    else { minX = vpW.value - cw; maxX = 0; }
    let minY: number, maxY: number;
    if (ch <= vpH.value) { minY = (vpH.value - ch) / 2; maxY = minY; }
    else { minY = vpH.value - ch; maxY = 0; }
    tx.value = clamp(tx.value, minX, maxX);
    ty.value = clamp(ty.value, minY, maxY);
  };

  const pinchGesture = Gesture.Pinch()
    .onStart((e) => {
      savedScale.value = scale.value;
      savedTx.value = tx.value;
      savedTy.value = ty.value;
      savedFocalX.value = e.focalX;
      savedFocalY.value = e.focalY;
    })
    .onUpdate((e) => {
      const damped = 1 + (e.scale - 1) * PINCH_SENSITIVITY;
      const ns = clamp(savedScale.value * damped, 1, MAX_ZOOM);
      const cx = (savedFocalX.value - savedTx.value) / savedScale.value;
      const cy = (savedFocalY.value - savedTy.value) / savedScale.value;
      scale.value = ns;
      tx.value = savedFocalX.value - cx * ns;
      ty.value = savedFocalY.value - cy * ns;
      clampOffsets(ns);
    })
    .onEnd(() => {
      savedScale.value = scale.value;
      savedTx.value = tx.value;
      savedTy.value = ty.value;
    });

  const panGesture = Gesture.Pan()
    .maxPointers(1)
    .minDistance(2)
    .onBegin(() => {
      cancelAnimation(tx);
      cancelAnimation(ty);
      savedTx.value = tx.value;
      savedTy.value = ty.value;
    })
    .onStart(() => {
      cancelAnimation(tx);
      cancelAnimation(ty);
      savedTx.value = tx.value;
      savedTy.value = ty.value;
    })
    .onUpdate((e) => {
      tx.value = savedTx.value + e.translationX;
      ty.value = savedTy.value + e.translationY;
      clampOffsets(scale.value);
    })
    .onEnd((e) => {
      'worklet';
      const s = scale.value;
      const cw = vpW.value * s;
      const ch = vpH.value * s;
      let minX: number, maxX: number;
      if (cw <= vpW.value) { minX = (vpW.value - cw) / 2; maxX = minX; }
      else { minX = vpW.value - cw; maxX = 0; }
      let minY: number, maxY: number;
      if (ch <= vpH.value) { minY = (vpH.value - ch) / 2; maxY = minY; }
      else { minY = vpH.value - ch; maxY = 0; }
      tx.value = withDecay({ velocity: e.velocityX, clamp: [minX, maxX], deceleration: 0.998 });
      ty.value = withDecay({ velocity: e.velocityY, clamp: [minY, maxY], deceleration: 0.998 });
    });

  const doubleTapGesture = Gesture.Tap()
    .numberOfTaps(2)
    .maxDuration(260)
    .onEnd((e) => {
      const s1 = 1;
      const s3 = clamp(DOUBLE_TAP_ZOOM, 1, MAX_ZOOM);
      const s2 = clamp(Math.sqrt(s1 * s3), s1, s3);
      const cur = scale.value;
      const mid12 = Math.sqrt(s1 * s2);
      const mid23 = Math.sqrt(s2 * s3);
      let target: number;
      if (cur < mid12) target = s2;
      else if (cur < mid23) target = s3;
      else target = s1;
      const cx = (e.x - tx.value) / scale.value;
      const cy = (e.y - ty.value) / scale.value;
      let ntx = e.x - cx * target;
      let nty = e.y - cy * target;
      const cw = vpW.value * target;
      const ch = vpH.value * target;
      if (cw <= vpW.value) { ntx = (vpW.value - cw) / 2; } else { ntx = clamp(ntx, vpW.value - cw, 0); }
      if (ch <= vpH.value) { nty = (vpH.value - ch) / 2; } else { nty = clamp(nty, vpH.value - ch, 0); }
      scale.value = withTiming(target, { duration: 200 });
      tx.value = withTiming(ntx, { duration: 200 });
      ty.value = withTiming(nty, { duration: 200 });
      savedScale.value = target;
      savedTx.value = ntx;
      savedTy.value = nty;
    });

  const onTapCb = useCallback(() => { onTap?.(); }, [onTap]);
  const singleTapGesture = Gesture.Tap()
    .numberOfTaps(1)
    .maxDuration(260)
    .requireExternalGestureToFail(doubleTapGesture, panGesture)
    .onEnd((_e, success) => {
      if (!success) return;
      if (onTap) runOnJS(onTapCb)();
    });

  const composedGesture = Gesture.Simultaneous(
    Gesture.Exclusive(doubleTapGesture, singleTapGesture),
    pinchGesture,
    panGesture,
  );

  const animatedCanvasStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: tx.value },
      { translateY: ty.value },
      { scale: scale.value },
    ],
  }));

  return (
    <GestureHandlerRootView style={[styles.viewport, { backgroundColor }, style]}>
      <View
        style={{ flex: 1 }}
        onLayout={(e) => {
          const { width, height } = e.nativeEvent.layout;
          setViewport({ w: width, h: height });
        }}
      >
        <GestureDetector gesture={composedGesture}>
          <View style={{ flex: 1, overflow: 'hidden' }}>
            {viewport.w > 0 && viewport.h > 0 && (
              <Animated.View
                style={[
                  {
                    position: 'absolute', top: 0, left: 0,
                    width: viewport.w, height: viewport.h,
                    transformOrigin: [0, 0, 0] as any,
                  },
                  animatedCanvasStyle,
                ]}
              >
                <Image
                  source={{ uri }}
                  style={{ width: '100%', height: '100%' }}
                  resizeMode="contain"
                />
              </Animated.View>
            )}
          </View>
        </GestureDetector>
      </View>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  viewport: {
    overflow: 'hidden',
  },
});
