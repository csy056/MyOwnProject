import { useEffect, useState } from 'react';
import { Modal, StyleSheet, View } from 'react-native';

import { PRODUCTS, useSimulator } from '@/monetization';

import { Button, T } from './components';
import { colors, space } from './theme';

// 광고·결제 시뮬레이션 모달. 실제 SDK를 붙이면 이 컴포넌트는 쓰이지 않는다.
export function SimulatorHost() {
  const request = useSimulator((s) => s.request);
  const setRequest = useSimulator((s) => s.setRequest);
  const [left, setLeft] = useState(0);

  useEffect(() => {
    if (request?.kind !== 'ad') return;
    setLeft(3);
    const id = setInterval(() => setLeft((v) => (v > 0 ? v - 1 : 0)), 1000);
    return () => clearInterval(id);
  }, [request]);

  if (!request) return null;
  const finish = (ok: boolean) => {
    request.resolve(ok);
    setRequest(null);
  };

  return (
    <Modal transparent animationType="fade" visible onRequestClose={() => finish(false)}>
      <View style={styles.backdrop}>
        <View style={styles.box}>
          {request.kind === 'ad' ? (
            <>
              <T faint size={12}>광고 시뮬레이션 (개발용)</T>
              <T size={18} style={{ marginVertical: space.md }}>
                {request.placement === 'rewind' ? '광고를 보면 마지막 선택 직전으로 되돌아갑니다.' : '광고를 보면 이번 원정 보급이 두 배가 됩니다.'}
              </T>
              <T dim>실제 출시 버전에서는 이 자리에 보상형 광고가 재생됩니다.</T>
              <View style={{ height: space.lg }} />
              <Button testID="sim-ad-reward" kind="primary" label={left > 0 ? `${left}초 후 보상` : '보상 받기'} disabled={left > 0} onPress={() => finish(true)} />
              <Button label="닫기 (보상 없음)" kind="ghost" onPress={() => finish(false)} />
            </>
          ) : (
            <>
              <T faint size={12}>결제 시뮬레이션 (개발용)</T>
              <T size={18} style={{ marginVertical: space.md }}>
                {PRODUCTS[request.product].title} · {PRODUCTS[request.product].price}
              </T>
              <T dim>{PRODUCTS[request.product].description}</T>
              <T faint size={13} style={{ marginTop: space.sm }}>실제 결제는 일어나지 않습니다.</T>
              <View style={{ height: space.lg }} />
              <Button kind="primary" label="구매 (시뮬레이션)" onPress={() => finish(true)} />
              <Button label="취소" kind="ghost" onPress={() => finish(false)} />
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'center', padding: space.xl },
  box: { backgroundColor: colors.bgRaised, borderRadius: 10, padding: space.xl, borderWidth: 1, borderColor: colors.line, maxWidth: 480, width: '100%', alignSelf: 'center' },
});
