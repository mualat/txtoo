import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { decryptText } from './utils/crypto';
import { Copy, Check, ArrowLeft, Loader2 } from 'lucide-react';

interface FetchResponse {
    type: string;
    status: number;
    data: {
        id: string;
        cipher_text: string;
        iv: string;
        expiresAt: number;
    };
}

function ViewNote() {
    const { idKey } = useParams<{ idKey: string }>();
    const navigate = useNavigate();
    const [decryptedContent, setDecryptedContent] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState('');
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        const fetchAndDecrypt = async () => {
            if (!idKey) {
                setError('Invalid URL format');
                setIsLoading(false);
                return;
            }

            // Parse id and key from the URL parameter
            const parts = idKey.split('~');
            if (parts.length !== 2) {
                setError('Invalid URL format. Expected format: /{id}~{key}');
                setIsLoading(false);
                return;
            }

            const [id, key] = parts;

            try {
                // Fetch encrypted data from the worker
                const workerUrl = import.meta.env.VITE_WORKERS_URL || '';
                const fetchUrl = workerUrl ? `${workerUrl}/fetch/${id}` : `/fetch/${id}`;

                const response = await fetch(fetchUrl);

                if (!response.ok) {
                    if (response.status === 404) {
                        setError('Note not found or has expired');
                    } else {
                        setError('Failed to fetch note');
                    }
                    setIsLoading(false);
                    return;
                }

                const result: FetchResponse = await response.json();
                const { cipher_text, iv } = result.data;

                // Decrypt the content locally
                const decrypted = await decryptText(cipher_text, iv, key);
                setDecryptedContent(decrypted);
            } catch (err) {
                console.error('Error fetching or decrypting:', err);
                setError('Failed to decrypt note. The key might be incorrect.');
            } finally {
                setIsLoading(false);
            }
        };

        fetchAndDecrypt();
    }, [idKey]);

    const copyToClipboard = () => {
        navigator.clipboard.writeText(decryptedContent);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const goHome = () => {
        navigate('/');
    };

    if (isLoading) {
        return (
            <div className="h-screen flex items-center justify-center bg-black">
                <div className="text-center">
                    <Loader2 className="w-12 h-12 text-emerald-400 animate-spin mx-auto mb-4" />
                    <p className="text-slate-500">Decrypting your note...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="h-screen flex items-center justify-center bg-black">
                <div className="text-center max-w-md mx-4">
                    <div className="bg-[#0a0a0a] border-2 border-red-500/30 p-6">
                        <h2 className="text-xl font-bold text-red-400 mb-3">Error</h2>
                        <p className="text-slate-300 mb-4 text-sm">{error}</p>
                        <button
                            onClick={goHome}
                            className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-4 py-2 border-2 border-emerald-600 hover:border-emerald-500 transition-all flex items-center gap-2 mx-auto shadow-[2px_2px_0_0_rgba(0,0,0,0.3)] text-sm"
                        >
                            <ArrowLeft className="w-4 h-4" />
                            Go Home
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="h-screen flex flex-col bg-black text-white overflow-hidden">
            <nav className="bg-[#0a0a0a] border-b-2 border-emerald-500/30 px-4 py-2 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <h1 className="text-lg font-bold text-emerald-400">{import.meta.env.VITE_SITE_NAME || "TXTOO"}</h1>
                    <span className="text-slate-500 text-xs">Viewing Note</span>
                </div>

                <div className="flex gap-2">
                    <button
                        onClick={copyToClipboard}
                        className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-4 py-1.5 border-2 border-emerald-600 hover:border-emerald-500 transition-all flex items-center gap-2 shadow-[2px_2px_0_0_rgba(0,0,0,0.3)] text-sm"
                    >
                        {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                        {copied ? 'Copied!' : 'Copy'}
                    </button>
                    <button
                        onClick={goHome}
                        className="bg-[#111111] hover:bg-[#1a1a1a] text-white font-bold px-4 py-1.5 border-2 border-emerald-900/30 hover:border-emerald-500/30 transition-all flex items-center gap-2 shadow-[2px_2px_0_0_rgba(0,0,0,0.3)] text-sm"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        New Note
                    </button>
                </div>
            </nav>

            <div className="flex-1 overflow-auto">
                <div className="p-4">
                    <div className="bg-[#0a0a0a] border-2 border-emerald-500/20 p-4">
                        <pre className="text-white font-mono text-sm leading-relaxed whitespace-pre-wrap break-words">
                            {decryptedContent}
                        </pre>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default ViewNote;
