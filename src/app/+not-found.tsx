import { Redirect } from 'expo-router';

// 웹에서 알 수 없는 주소로 들어오면 첫 화면으로 보낸다.
export default function NotFound() {
  return <Redirect href="/" />;
}
