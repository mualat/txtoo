import { useState, useEffect } from 'react';
import { Settings, Send, Copy, Check, QrCode, X } from 'lucide-react';
import { encryptText } from './utils/crypto';
import QRCodeLib from 'qrcode';

interface SubmitResponse {
    type: string;
    status: number;
    data: {
        id: string;
    };
}

function Home() {
    const [content, setContent] = useState('');
    const [password, setPassword] = useState('');
    const [ttl, setTtl] = useState(86400);
    const [isEncrypting, setIsEncrypting] = useState(false);
    const [showSettings, setShowSettings] = useState(false);
    const [showResult, setShowResult] = useState(false);
    const [shareUrl, setShareUrl] = useState('');
    const [qrCodeDataUrl, setQrCodeDataUrl] = useState('');
    const [copied, setCopied] = useState(false);
    const [baseUrl, setBaseUrl] = useState('');

    useEffect(() => {
        setBaseUrl(window.location.origin);
    }, []);

    const generateRandomPassword = (): string => {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
        const length = 16;
        let result = '';
        const randomValues = new Uint8Array(length);
        crypto.getRandomValues(randomValues);
        for (let i = 0; i < length; i++) {
            result += chars[randomValues[i] % chars.length];
        }
        return result;
    };

    const handleEncryptAndSubmit = async () => {
        if (!content) {
            alert('Please enter content');
            return;
        }

        setIsEncrypting(true);

        try {
            const encryptionPassword = password || generateRandomPassword();
            const encrypted = await encryptText(content, encryptionPassword);

            const workerUrl = import.meta.env.VITE_WORKERS_URL || '';
            const submitUrl = workerUrl ? `${workerUrl}/submit` : '/submit';

            const response = await fetch(submitUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    ttl,
                    cipherText: encrypted.cipherText,
                    iv: encrypted.iv,
                }),
            });

            if (response.ok) {
                const result: SubmitResponse = await response.json();
                const noteId = result.data.id;

                const url = `${baseUrl}/${noteId}~${encryptionPassword}`;
                setShareUrl(url);

                const qrDataUrl = await QRCodeLib.toDataURL(url, {
                    width: 300,
                    margin: 2,
                    color: {
                        dark: '#10b981',
                        light: '#0f172a'
                    }
                });
                setQrCodeDataUrl(qrDataUrl);

                setShowResult(true);
                setContent('');
            } else {
                alert('Submission failed. Please try again.');
            }
        } catch (error) {
            console.error('Encryption or submission error:', error);
            alert('An error occurred. Please try again.');
        } finally {
            setIsEncrypting(false);
        }
    };

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const closeResult = () => {
        setShowResult(false);
        setShareUrl('');
        setQrCodeDataUrl('');
        setPassword('');
    };

    return (
        <div className="h-screen flex flex-col bg-black text-white overflow-hidden">
            <nav className="bg-[#0a0a0a] border-b-2 border-emerald-500/30 px-4 py-2 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <h1 className="text-lg font-bold text-emerald-400">{import.meta.env.VITE_SITE_NAME || "TXTOO"}</h1>
                    <button
                        onClick={() => setShowSettings(!showSettings)}
                        className="p-2 hover:bg-[#111111] border border-transparent hover:border-emerald-500/30 transition-all"
                        title="Settings"
                    >
                        <Settings className="w-5 h-5 text-slate-500 hover:text-emerald-400" />
                    </button>
                </div>

                <button
                    onClick={handleEncryptAndSubmit}
                    disabled={isEncrypting || !content}
                    className="bg-emerald-600 hover:bg-emerald-500 disabled:bg-[#111111] disabled:border disabled:border-emerald-900/30 disabled:cursor-not-allowed text-white font-bold px-4 py-1.5 border-2 border-emerald-600 hover:border-emerald-500 transition-all flex items-center gap-2 shadow-[2px_2px_0_0_rgba(0,0,0,0.3)] text-sm"
                >
                    <Send className="w-4 h-4" />
                    {isEncrypting ? 'SUBMITTING...' : 'SUBMIT'}
                </button>
            </nav>

            <div className="flex-1 flex overflow-hidden border-2 border-transparent">
                <textarea
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    placeholder="Write your text note here..."
                    className="flex-1 w-full p-4 bg-black text-white placeholder-slate-700 focus:outline-none resize-none font-mono text-sm leading-relaxed"
                    spellCheck={false}
                />
            </div>

            {showSettings && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50">
                    <div className="bg-[#0a0a0a] shadow-2xl p-6 max-w-md w-full mx-4 border-2 border-emerald-500/30">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-xl font-semibold text-white">Encryption Settings</h2>
                            <button
                                onClick={() => setShowSettings(false)}
                                className="text-slate-400 hover:text-white transition-colors"
                            >
                                <X className="w-6 h-6" />
                            </button>
                        </div>

                        <div className="space-y-6">
                            <div>
                                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                                    Encryption Password <span className="text-slate-500 font-normal">(optional)</span>
                                </label>
                                <input
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="Leave empty for auto-generated password"
                                    className="w-full px-3 py-2 bg-black border-2 border-emerald-900/30 text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500 transition-colors text-sm"
                                />
                                <p className="mt-1 text-xs text-slate-500">
                                    If empty, a random password will be generated and included in the share URL
                                </p>
                            </div>

                            <div>
                                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                                    Time to Live
                                </label>
                                <select
                                    value={ttl}
                                    onChange={(e) => setTtl(Number(e.target.value))}
                                    className="w-full px-3 py-2 bg-black border-2 border-emerald-900/30 text-white focus:outline-none focus:border-emerald-500 transition-colors text-sm"
                                >
                                    <option value={180}>3 Mins</option>
                                    <option value={600}>10 Mins</option>
                                    <option value={1800}>30 Mins</option>
                                    <option value={3600}>1 Hour</option>
                                    <option value={21600}>6 Hours</option>
                                    <option value={43200}>12 Hours</option>
                                    <option value={86400}>24 Hours (Default)</option>
                                    <option value={604800}>7 Days</option>
                                    <option value={2592000}>30 Days</option>
                                </select>
                            </div>

                            <button
                                onClick={() => setShowSettings(false)}
                                className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2 px-4 border-2 border-emerald-600 hover:border-emerald-500 transition-all shadow-[2px_2px_0_0_rgba(0,0,0,0.3)] text-sm"
                            >
                                Done
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {showResult && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50">
                    <div className="bg-[#0a0a0a] shadow-2xl p-6 max-w-lg w-full mx-4 border-2 border-emerald-500/30">
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-2">
                                <QrCode className="w-5 h-5 text-emerald-400" />
                                <h2 className="text-xl font-semibold text-white">Note Encrypted</h2>
                            </div>
                            <button
                                onClick={closeResult}
                                className="text-slate-400 hover:text-white transition-colors"
                            >
                                <X className="w-6 h-6" />
                            </button>
                        </div>

                        <div className="space-y-4">
                            <div className="flex justify-center">
                                {qrCodeDataUrl && (
                                    <div className="bg-black p-3 border-2 border-emerald-500/20">
                                        <img src={qrCodeDataUrl} alt="QR Code" className="w-48 h-48 mx-auto" />
                                    </div>
                                )}
                            </div>

                            <div>
                                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                                    Share URL
                                </label>
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        value={shareUrl}
                                        readOnly
                                        className="flex-1 px-3 py-2 bg-black border-2 border-emerald-900/30 text-emerald-400 text-xs font-mono focus:outline-none focus:border-emerald-500"
                                    />
                                    <button
                                        onClick={() => copyToClipboard(shareUrl)}
                                        className="px-3 py-2 bg-emerald-600 hover:bg-emerald-500 border-2 border-emerald-600 hover:border-emerald-500 transition-all flex items-center gap-2 shadow-[2px_2px_0_0_rgba(0,0,0,0.3)]"
                                    >
                                        {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                                    </button>
                                </div>
                                <p className="mt-2 text-xs text-slate-500">
                                    Anyone with this URL can decrypt and read your note
                                </p>
                            </div>

                            <div className="bg-black border-2 border-emerald-900/30 p-3">
                                <p className="text-xs text-slate-400">
                                    <span className="font-semibold text-emerald-400">Note:</span> The password is included in the URL after the ~ symbol. Keep this URL secure.
                                </p>
                            </div>

                            <button
                                onClick={closeResult}
                                className="w-full bg-[#111111] hover:bg-[#1a1a1a] text-white font-bold py-2 px-4 border-2 border-emerald-900/30 hover:border-emerald-500/30 transition-all shadow-[2px_2px_0_0_rgba(0,0,0,0.3)] text-sm"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default Home;
