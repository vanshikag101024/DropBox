import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  ActiveTab,
  DropPayload,
  GlobalTelemetryStats,
  NearbyDevice,
  NearbyTransferOffer,
  nearbyTransferResponse,
} from './types';
import { INITIAL_SEED_DROPS, INITIAL_FEATURED_DROP } from './data/seedDrops';
import { BackgroundWaves } from './components/BackgroundWaves';
import { Header } from './components/Header';
import { Footer } from './components/Footer';
import { TransferConsole } from './components/TransferConsole';
import { ActiveSharesView } from './components/ActiveSharesView';
import { StandaloneRecipientView } from './components/StandaloneRecipientView';
import { IncomingNearbyTransferModal } from './components/IncomingNearbyTransferModal';
import { RatingPromptModal } from './components/RatingPromptModal';
import {
  getlocalDevice,
  announcePresence,
  leavePresence,
  subscribeToLocalMesh,
  updateRemoteReceivingState,
  respondToNearbyTransfer,
  subscribeToIncomingOffers,
  subscribeToTransferResponses
} from './utils/nearbyService';
import { dropApi } from './services/dropApi';
import { ThemeProvider, useTheme } from './context/ThemeContext';

function AppContent() {
  const { accent, accentBorder, accentLight } = useTheme();
  const [activeTab, setActiveTab] = useState<ActiveTab>('transfer');
  const [drops, setDrops] = useState<DropPayload[]>([]);
  const [selectedDrop, setSelectedDrop] = useState<DropPayload | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [backendConnected, setBackendConnected] = useState<boolean>(false);
  const [showRatingPrompt, setShowRatingPrompt] = useState<boolean>(false);
  const [globalStats, setGlobalStats] = useState<GlobalTelemetryStats>({
    downloadedFiles: 0,
    sentTransfers: 0,
    gigabytesSent: 0,
    bytesSent: 0,
    rating: 5.0,
    ratingsCount: 0,
  });
  const [isRecipientMode, setIsRecipientMode] = useState<boolean>(() => {
    return window.location.hash.includes('vault=');
  });
  const [isLoadingRecipient, setIsLoadingRecipient] = useState<boolean>(false);
  const [recipientError, setRecipientError] = useState<string | null>(null);

  const [localDevice] = useState<NearbyDevice>(() => getlocalDevice());
  const [nearbyDevices, setnearbyDevices] = useState<NearbyDevice[]>([]);
  const [incomingOffer, setIncomingOffer] = useState<NearbyTransferOffer | null>(null);
  const [nearbyTransferResponse, setnearbyTransferResponse] = useState<nearbyTransferResponse | null>(null);
  const [receiverSuccessEvent, setreceiverSuccessEvent] = useState<{ id: string; title: string; subtitle: string } | null>(null);

  const [isReceivingActive, setIsReceivingActive] = useState<boolean>(false);
  const isReceivingActiveRef = useRef<boolean>(false);
  isReceivingActiveRef.current = isReceivingActive;

  const handleReceivingStateChange = useCallback(
    (active: boolean) => {
      setIsReceivingActive(active);
      isReceivingActiveRef.current = active;

      announcePresence(localDevice, active).then((devs) => {
        if (devs) setnearbyDevices(devs);
      });
      updateRemoteReceivingState(localDevice.id, active);
    },
    [localDevice]
  );

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((current) => (current === msg ? null : current));
    }, 2800);
  }, []);

  useEffect(() => {
    announcePresence(localDevice, isReceivingActiveRef.current).then((devs) => {
      if (devs) {
        setnearbyDevices((prev) => {
          const map = new Map<string, NearbyDevice>();
          for (const d of [...prev, ...devs]) {
            if (d.id !== localDevice.id) map.set(d.id, d);
          }
          return Array.from(map.values());
        });
      }
    });

    const interval = setInterval(() => {
      announcePresence(localDevice, isReceivingActiveRef.current).then((devs) => {
        if (devs) {
          setnearbyDevices((prev) => {
            const map = new Map<string, NearbyDevice>();
            for (const d of [...prev, ...devs]) {
              if (d.id !== localDevice.id) map.set(d.id, d);
            }
            return Array.from(map.values());
          });
        }
      });
    }, 3000);

    const unsubMesh = subscribeToLocalMesh(
      (discoveredDev) => {
        setnearbyDevices((prev) => {
          const filtered = prev.filter((d) => d.id !== discoveredDev.id);
          return [...filtered, discoveredDev];
        });
      },
      (leftDeviceId) => {
        setnearbyDevices((prev) => prev.filter((d) => d.id !== leftDeviceId));
      },
      (deviceId, isReceiving) => {
        setnearbyDevices((prev) => {
          return prev.map((d) => (d.id === deviceId ? { ...d, isReceiving } : d));
        });
      },
      () => ({ device: localDevice, isReceiving: isReceivingActiveRef.current })
    );

    const unsubOffers = subscribeToIncomingOffers(localDevice.id, (offer) => {
      setIncomingOffer(offer);
      showToast(`Incoming file from ${offer.fromDevice.name}!`);
    });

    const unsubResponses = subscribeToTransferResponses(localDevice.id, (transferId, status, toDeviceId) => {
      setnearbyTransferResponse({ transferId, status, toDeviceId, fromDeviceId: localDevice.id });
    });

    return () => {
      clearInterval(interval);
      unsubMesh();
      unsubOffers();
      unsubResponses();
      leavePresence(localDevice.id);
    };
  }, [localDevice, showToast]);

  useEffect(() => {
    const fetchDrops = async () => {
      try {
        const liveDrops = await dropApi.listDrops();
        setDrops(liveDrops || []);
        setSelectedDrop(null);
        setBackendConnected(true);
      } catch (err: any) {
      }
    };

    const fetchStats = async () => {
      try {
        const stats = await dropApi.getStats();
        if (stats) {
          setGlobalStats(stats);
        }
      } catch (err: any) {
      }
    };

    fetchDrops();
    fetchStats();

    const unsubStats = dropApi.subscribeStats((stats) => {
      if (stats) {
        setGlobalStats(stats);
      }
    });

    return () => {
      unsubStats();
    };
  }, []);

  useEffect(() => {
    let eventSource: EventSource | null = null;
    try {
      eventSource = new EventSource('/api/events');

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'connected') {
            setBackendConnected(true);
          } else if (data.type === 'drop_created') {
            setDrops((prev) => {
              if (prev.some((d) => d.id === data.payload.id)) return prev;
              return [data.payload, ...prev];
            });
            showToast(`New live drop broadcast: ${data.payload.name}`);
          } else if (data.type === 'drop_deleted') {
            setDrops((prev) => prev.filter((d) => d.id !== data.payload.id));
            setSelectedDrop((prev) => {
              if (prev && prev.id === data.payload.id) {
                return null;
              }
              return prev;
            });
            if (data.payload.reason === 'burned') {
              showToast('Drop single-access limit reached: Shredded in real-time');
            } else if (data.payload.reason === 'expired') {
              showToast('Drop timer expired: Shredded from memory');
            }
          } else if (data.type === 'drop_consumed') {
            setDrops((prev) =>
              prev.map((d) =>
                d.id === data.payload.id ? { ...d, transfersConsumed: data.payload.transfersConsumed } : d
              )
            );
            setSelectedDrop((prev) => {
              if (prev && prev.id === data.payload.id) {
                return { ...prev, transfersConsumed: data.payload.transfersConsumed };
              }
              return prev;
            });
          } else if (data.type === 'stats_update' && data.payload) {
            setGlobalStats(data.payload);
          } else if ((data.type === 'nearby_devices' || data.type === 'nearby-devices') && data.payload) {
            const activeReceivers = (data.payload || []).filter(
              (d: NearbyDevice) => d.id !== localDevice.id
            );
            setnearbyDevices(activeReceivers);
          } else if ((data.type === 'nearby_transfer_offer' || data.type === 'nearby-transfer-offer') && data.payload) {
            const offer = data.payload as NearbyTransferOffer;
            if (offer && offer.toDeviceId === localDevice.id) {
              setIncomingOffer(offer);
              showToast(`Incoming file from ${offer.fromDevice.name}!`);
            }
          } else if ((data.type === 'nearby_transfer_response' || data.type === 'nearby-transfer-response') && data.payload) {
            setnearbyTransferResponse(data.payload);
          }
        } catch (e) {
          console.error('Failed to parse SSE payload:', e);
        }
      };

      eventSource.onerror = () => {
        setBackendConnected(false);
      };
    } catch (err: any) {
    }

    return () => {
      if (eventSource) {
        eventSource.close();
      }
    };
  }, [showToast]);

  useEffect(() => {
    const handleHash = async () => {
      const hash = window.location.hash;
      if (hash.includes('vault=')) {
        setIsRecipientMode(true);
        setIsLoadingRecipient(true);
        setRecipientError(null);
        const params = new URLSearchParams(hash.replace(/^#/, ''));
        const vaultId = params.get('vault');
        const encodedData = params.get('data');
        if (encodedData) {
          try {
            const decoded = decodeURIComponent(encodedData);
            const jsonStr = decodeURIComponent(atob(decoded));
            const embeddedDrop = JSON.parse(jsonStr) as DropPayload;
            if (embeddedDrop && embeddedDrop.id) {
              try {
                localStorage.setItem(`ephem-drop-${embeddedDrop.id}`, JSON.stringify(embeddedDrop));
              } catch { }
              setSelectedDrop(embeddedDrop);
              setIsLoadingRecipient(false);
              return;
            }
          } catch (e) {
            console.debug('Embedded data decode notice:', e);
          }
        }

        if (vaultId) {
          try {
            const drop = await dropApi.getDrop(vaultId);
            setSelectedDrop(drop);
            setIsLoadingRecipient(false);
          } catch {
            const match = drops.find((d) => d.id === vaultId);
            if (match) {
              setSelectedDrop(match);
              setIsLoadingRecipient(false);
            } else {
              setIsLoadingRecipient(false);
              setRecipientError('This document has expired, reached its single-view limit, or was already burned.');
            }
          }
        } else {
          setIsLoadingRecipient(false);
          setRecipientError('Invalid document link.');
        }
      } else {
        setIsRecipientMode(false);
        setRecipientError(null);
      }
    };

    handleHash();
    window.addEventListener('hashchange', handleHash);
    return () => window.removeEventListener('hashchange', handleHash);
  }, [drops, showToast]);

  const handleCreateDrop = async (newDrop: DropPayload) => {
    try {
      const savedDrop = await dropApi.createDrop(newDrop);
      setDrops((prev) => [savedDrop, ...prev.filter((d) => d.id !== savedDrop.id)]);
      setSelectedDrop(savedDrop);

      setGlobalStats((prev) => {
        const bytes = (prev.bytesSent || 0) + (savedDrop.sizeBytes || 0);
        return {
          ...prev,
          sentTransfers: prev.sentTransfers + 1,
          bytesSent: bytes,
          gigabytesSent: Number((bytes / (1024 * 1024 * 1024)).toFixed(4)),
        };
      });

      try {
        const existing = JSON.parse(localStorage.getItem('my-created-vault-ids') || '[]');
        if (!existing.includes(savedDrop.id)) {
          localStorage.setItem('my-created-vault-ids', JSON.stringify([savedDrop.id, ...existing]));
        }
      } catch { }
      setTimeout(() => {
        setShowRatingPrompt(true);
      }, 1200);
    } catch {

      setDrops((prev) => [newDrop, ...prev]);
      setSelectedDrop(newDrop);

      setGlobalStats((prev) => {
        const bytes = (prev.bytesSent || 0) + (newDrop.sizeBytes || 0);
        return {
          ...prev,
          sentTransfers: prev.sentTransfers + 1,
          bytesSent: bytes,
          gigabytesSent: Number((bytes / (1024 * 1024 * 1024)).toFixed(4)),
        };
      });

      try {
        const existing = JSON.parse(localStorage.getItem('my-created-vault-ids') || '[]');
        if (!existing.includes(newDrop.id)) {
          localStorage.setItem('my-created-vault-ids', JSON.stringify([newDrop.id, ...existing]));
        }
      } catch { }
      setTimeout(() => {
        setShowRatingPrompt(true);
      }, 1200);
    }
  };

  const handleSelectDrop = (drop: DropPayload) => {
    setSelectedDrop(drop);
    setActiveTab('active-shares');
  };

  const handleConsumeTransfer = async (dropId: string) => {

    setGlobalStats((prev) => ({
      ...prev,
      downloadedFiles: prev.downloadedFiles + 1,
    }));

    setTimeout(() => {
      window.location.hash = '';
      setIsRecipientMode(false);
      setActiveTab('send');
      setShowRatingPrompt(true);
    }, 2500);

    try {
      const updated = await dropApi.consumeDrop(dropId);
      if (updated && updated.status === 'burned') {
        showToast('Single-burn limit reached: Payload shredded from memory!');
        setDrops((prev) => prev.filter((d) => d.id !== dropId));
        setSelectedDrop(INITIAL_FEATURED_DROP);
        setActiveTab('transfer');
      } else if (updated) {
        setDrops((prev) =>
          prev.map((d) => (d.id === dropId ? updated : d))
        );
        setSelectedDrop(updated);
      }
    } catch {

      setDrops((prev) =>
        prev.map((d) => {
          if (d.id === dropId) {
            const newConsumed = d.transfersConsumed + 1;
            const updated = { ...d, transfersConsumed: newConsumed };
            if (newConsumed >= d.transfersMax && d.expirationPolicy === 'never') {
              showToast('Single-burn limit reached: Payload memory zeroized!');
            }
            return updated;
          }
          return d;
        })
      );
    }
  };

  const handleRate = async (rating: number) => {
    try {
      const stats = await dropApi.submitRating(rating);
      if (stats) {
        setGlobalStats(stats);
      } else {
        setGlobalStats((prev) => {
          const count = (prev.ratingsCount || 28) + 1;
          const currentSum = (prev.rating || 4.9) * (prev.ratingsCount || 28);
          const newRating = Number(((currentSum + rating) / count).toFixed(1));
          return {
            ...prev,
            rating: newRating,
            ratingsCount: count,
          };
        });
      }
      showToast(`Rating submitted (${rating} ★). Average updated!`);
    } catch (e) {
      console.warn('Error saving rating:', e);
    }
  };

  const handleBurnDrop = async (dropId: string) => {
    try {
      await dropApi.deleteDrop(dropId);
    } catch (e) {
      console.warn('Backend delete fallback:', e);
    }

    setDrops((prev) => prev.filter((d) => d.id !== dropId));
    showToast(`Drop ${dropId} shredded and removed from live server.`);

    if (selectedDrop && selectedDrop.id === dropId) {
      const nextRemaining = drops.find((d) => d.id !== dropId);
      if (nextRemaining) {
        setSelectedDrop(nextRemaining);
      } else {
        setSelectedDrop(null);
        setActiveTab('transfer');
      }
    }
  };

  if (isRecipientMode) {
    return (
      <div className="relative min-h-screen flex flex-col bg-[#f0f7ff] text-slate-900 font-sans">
        <BackgroundWaves />
        <StandaloneRecipientView
          drop={selectedDrop}
          isLoading={isLoadingRecipient}
          errorMessage={recipientError
          }
          onConsumeTransfer={handleConsumeTransfer}
          onShowToast={showToast}
          onOpenAppMode={() => {
            window.location.hash = '';
            setIsRecipientMode(false);
            setActiveTab('send');
          }}
        />

        <div
          id="toast-msg"
          className={`fixed bottom-6 right-6 z-50 bg-white/95 backdrop-blur-md text-slate-800 px-5 py-3 rounded-2xl shadow-[0-12px-36px--6px-rgba(0,0,0,0.16),0-0-0-1px-rgba(0,0,0,0.06)] flex items-center gap-3 border border-slate-200/90 transition-all duration-300 pointer-events-none max-w-[90vw] ${toastMessage ? 'transl ate-y-0 opacity-100 scale-100' : 'translate-y-8 opacity-0 scale-95'
            }`}
        >
          <div
            className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 border ${toastMessage?.toLowerCase().includes('decline') || toastMessage?.toLowerCase().includes('error')
                ? 'bg-rose-50 border-rose-200 text-rose-600'
                : 'bg-emerald-50 border-emerald-200 text-emerald-600'
              }`}
          >
            <span className="material-symbols-outlined text-[16px]">
              {toastMessage?.toLowerCase().includes('decline') || toastMessage?.toLowerCase().includes('error')
                ? 'close'
                : 'check'}
            </span>  </div>  <span className="font-sans text-[13px] font-semibold text-slate-800 tracking-tight" id="toast-text">
            {toastMessage}
          </span>
        </div>

        <RatingPromptModal isOpen={showRatingPrompt}
          onRate={handleRate}
          onClose={() => setShowRatingPrompt(false)}
        />
      </div>
    );
  }

  return (
    <div className="relative min-h-screen flex flex-col bg-transparent text-slate-900 font-sans antialiased">

      <BackgroundWaves />

      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        activeSharesCount={drops.length}
      />

      <main className="w-full pt-2 sm:pt-4 relative z-10 flex-1 flex flex-col pb-12">
        {(activeTab === 'send' || activeTab === 'transfer') && (
          <TransferConsole initialMode="send"
            onCreateDrop={handleCreateDrop}
            onViewDrop={(drop) => {
              setSelectedDrop(drop);
              setActiveTab('active-shares');
            }}
            onShowToast={showToast}
            stats={globalStats}
            localDevice={localDevice}
            nearbyDevices={nearbyDevices}
            nearbyTransferResponse={nearbyTransferResponse}
            receiverSuccessEvent={receiverSuccessEvent}
            onPromptRate={() => setShowRatingPrompt(true)}
            onReceivingStateChange={handleReceivingStateChange}
            onReturnToHome={() => {
              setActiveTab('send');
              setreceiverSuccessEvent(null);
            }}
          />
        )}

        {activeTab === 'receive' && (
          <TransferConsole initialMode="receive"
            onCreateDrop={handleCreateDrop}
            onViewDrop={(drop) => {
              setSelectedDrop(drop);
              setActiveTab('active-shares');
            }}
            onShowToast={showToast}
            stats={globalStats}
            localDevice={localDevice}
            nearbyDevices={nearbyDevices}
            nearbyTransferResponse={nearbyTransferResponse}
            receiverSuccessEvent={receiverSuccessEvent}
            onPromptRate={() => setShowRatingPrompt(true)}
            onReceivingStateChange={handleReceivingStateChange}
            onReturnToHome={() => {
              setActiveTab('send');
              setreceiverSuccessEvent(null);
            }}
          />
        )}

        {activeTab === 'active-shares' && (
          <ActiveSharesView
            drops={drops}
            selectedDropId={selectedDrop?.id}
            onSelectDrop={(drop) => setSelectedDrop(drop)}
            onBurnDrop={handleBurnDrop}
            onShowToast={showToast}
            onNavigateTransfer={() => setActiveTab('send')}
            onConsumeTransfer={handleConsumeTransfer}
          />
        )}
      </main>
      <IncomingNearbyTransferModal offer={incomingOffer}
        onClose={() => setIncomingOffer(null)}
        onShowToast={showToast}
        onTransferCompleted={() => {
          setIncomingOffer(null);
          handleReceivingStateChange(false);
          setreceiverSuccessEvent({
            id: String(Date.now()),
            title: 'Transfer Complete',
            subtitle: 'File saved to Downloads. Returning to home...',
          });
        }}
      />

      <Footer />

      <RatingPromptModal
        isOpen={showRatingPrompt}
        onRate={handleRate}
        onClose={() => setShowRatingPrompt(false)}
      />

      <div id="toast-msg"
        className={`fixed bottom-6 right-6 z-50 bg-white/95 backdrop-blur-md text-slate-800 px-5 py-3 rounded-2xl shadow-[0-12px-36px--6px-rgba(0,0,0,0.16),0-0-0-1px-rgba(0,0,0,0.06)] flex items-center gap-3 border border-slate-200/90 transition-all duration-300 pointer-events-none max-w-[90vw] ${toastMessage ? 'translate-y-0 opacity-100 scale-100' : 'translate-y-8 opacity-0 scale-95'
          }`}
      >
        <div
          className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 border ${toastMessage?.toLowerCase().includes('decline') || toastMessage?.toLowerCase().includes('error')
              ? 'bg-rose-50 border-rose-200 text-rose-600'
              : 'bg-emerald-50 border-emerald-200 text-emerald-600'
            }`}
        >
          <span className="material-symbols-outlined text-[16px]">
            {toastMessage?.toLowerCase().includes('decline') || toastMessage?.toLowerCase().includes('error')
              ? 'close'
              : 'check'}
          </span>
        </div>
        <span className="font-sans text-[13px] font-semibold text-slate-800 tracking-tight" id="toast-text">
          {toastMessage}
        </span>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AppContent />
    </ThemeProvider>
  );
}