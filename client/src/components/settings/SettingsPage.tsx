import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { getSettings, updateSettings } from '../../services/api';

export default function SettingsPage() {
  const [aiEnabled, setAiEnabled] = useState(false);
  const [aiProvider, setAiProvider] = useState('claude');
  const [apiKey, setApiKey] = useState('');
  const [usdRate, setUsdRate] = useState('3.6');
  const [eurRate, setEurRate] = useState('3.9');
  const queryClient = useQueryClient();

  const { data: settings } = useQuery({
    queryKey: ['settings'],
    queryFn: getSettings,
  });

  useEffect(() => {
    if (settings) {
      setAiEnabled(settings.ai_enabled === 'true');
      setAiProvider(settings.ai_provider || 'claude');
      setApiKey(settings.ai_api_key || '');
      setUsdRate(settings.usd_rate || '3.6');
      setEurRate(settings.eur_rate || '3.9');
    }
  }, [settings]);

  const updateMutation = useMutation({
    mutationFn: updateSettings,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] });
      toast.success('הגדרות נשמרו');
    },
  });

  const handleSave = () => {
    updateMutation.mutate({
      ai_enabled: String(aiEnabled),
      ai_provider: aiProvider,
      ai_api_key: apiKey,
      usd_rate: usdRate,
      eur_rate: eurRate,
    });
  };

  return (
    <div className="max-w-2xl">
      <h2 className="text-2xl font-bold mb-6">הגדרות</h2>

      {/* Exchange rates */}
      <div className="card mb-6">
        <h3 className="font-semibold mb-4">שערי מט"ח</h3>
        <p className="text-sm text-gray-500 mb-4">
          שערים להמרת עסקאות במטבע זר לשקלים
        </p>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">שער דולר ($)</label>
            <input
              type="number"
              step="0.01"
              value={usdRate}
              onChange={(e) => setUsdRate(e.target.value)}
              className="input max-w-xs"
              placeholder="3.6"
            />
          </div>
          <div>
            <label className="label">שער יורו (&euro;)</label>
            <input
              type="number"
              step="0.01"
              value={eurRate}
              onChange={(e) => setEurRate(e.target.value)}
              className="input max-w-xs"
              placeholder="3.9"
            />
          </div>
        </div>

        <div className="mt-6 pt-4 border-t">
          <button
            onClick={handleSave}
            disabled={updateMutation.isPending}
            className="btn-primary"
          >
            {updateMutation.isPending ? 'שומר...' : 'שמור הגדרות'}
          </button>
        </div>
      </div>

      {/* AI Classification */}
      <div className="card">
        <h3 className="font-semibold mb-4">סיווג בינה מלאכותית</h3>

        <div className="space-y-4">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={aiEnabled}
              onChange={(e) => setAiEnabled(e.target.checked)}
              className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
            />
            <div>
              <span className="font-medium">הפעל סיווג AI</span>
              <p className="text-sm text-gray-500">
                עסקאות שלא זוהו לפי מילות מפתח יסווגו באמצעות AI
              </p>
            </div>
          </label>

          {aiEnabled && (
            <>
              <div>
                <label className="label">ספק AI</label>
                <select
                  value={aiProvider}
                  onChange={(e) => setAiProvider(e.target.value)}
                  className="input max-w-xs"
                >
                  <option value="claude">Claude (Anthropic)</option>
                  <option value="openai">GPT (OpenAI)</option>
                </select>
              </div>

              <div>
                <label className="label">מפתח API</label>
                <input
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder={aiProvider === 'claude' ? 'sk-ant-...' : 'sk-...'}
                  className="input max-w-md"
                />
                <p className="text-xs text-gray-500 mt-1">
                  המפתח נשמר מקומית בלבד ולא נשלח לשום מקום חוץ מהספק שנבחר
                </p>
              </div>
            </>
          )}
        </div>

        <div className="mt-6 pt-4 border-t">
          <button
            onClick={handleSave}
            disabled={updateMutation.isPending}
            className="btn-primary"
          >
            {updateMutation.isPending ? 'שומר...' : 'שמור הגדרות'}
          </button>
        </div>
      </div>
    </div>
  );
}
