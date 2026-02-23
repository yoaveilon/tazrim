import { GoogleLogin } from '@react-oauth/google';
import { useNavigate, Navigate } from 'react-router-dom';
import { useAuth } from './AuthContext';
import toast from 'react-hot-toast';

export default function LoginPage() {
  const { login, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  // If already authenticated, redirect to home
  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="bg-white rounded-2xl shadow-lg p-10 max-w-sm w-full text-center">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-primary-600 mb-2">Tazrim</h1>
          <p className="text-gray-500">ניהול תזרים חודשי חכם</p>
        </div>

        <div className="border-t border-gray-100 pt-6 mb-6">
          <p className="text-sm text-gray-600 mb-4">התחבר כדי להמשיך</p>
        </div>

        <div className="flex justify-center">
          <GoogleLogin
            onSuccess={async (credentialResponse) => {
              if (credentialResponse.credential) {
                try {
                  await login(credentialResponse.credential);
                  toast.success('התחברת בהצלחה!');
                  navigate('/', { replace: true });
                } catch (err) {
                  console.error('Login error:', err);
                  toast.error('שגיאה בהתחברות');
                }
              }
            }}
            onError={() => {
              toast.error('שגיאה בהתחברות עם Google');
            }}
            shape="rectangular"
            size="large"
            text="signin_with"
            locale="he"
          />
        </div>

        <p className="text-xs text-gray-400 mt-6">
          הנתונים שלך מאוחסנים באופן מאובטח ולא משותפים עם צד שלישי
        </p>
      </div>
    </div>
  );
}
