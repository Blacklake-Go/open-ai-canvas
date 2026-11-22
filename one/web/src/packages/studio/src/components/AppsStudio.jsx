"use client";

import React, { useState, useEffect } from 'react';
import { 
  FaUserTie, FaImage, FaMagic, FaVideo, FaFileAlt, 
  FaBriefcase, FaHome, FaMicrophone, FaHandSparkles, FaBuilding,
  FaUserInjured, FaStethoscope, FaCar, FaPaw, FaBalanceScale, FaTruck, FaMapMarkerAlt,
  FaRocket
} from "react-icons/fa";
import { registerAppInterest, getAppInterests } from '../muapi.js';
import toast from 'react-hot-toast';
import { ToastHost as Toaster } from '../ui';
import en from '../messages/en/appsStudio.json';
import zh from '../messages/zh/appsStudio.json';
import ja from '../messages/ja-JP/appsStudio.json';
import ko from '../messages/ko-KR/appsStudio.json';
import zhTw from '../messages/zh-TW/appsStudio.json';
import es from '../messages/es/appsStudio.json';
import { resolveCopy } from '../i18nUtils';

const APPS_MESSAGES = {
  'zh-CN': zh,
  'ja-JP': ja,
  'ko-KR': ko,
  'zh-TW': zhTw,
  es: es,
  'es-ES': es,
};

const templateApps = [
  {
    name: "AI Headshot Studio",
    description: "A headshot studio template concept with user accounts and a credit-based workflow.",
    icon: FaUserTie,
    color: "blue",
    thumbnail: "https://cdn.muapi.ai/apps/d9c39378f60e48098f6b6ce657dc18b5.png",
    isTemplate: true
  },
  {
    name: "Nano Banana Studio",
    description: "An AI image studio template concept with credit packs and subscription options.",
    icon: FaHandSparkles,
    color: "amber",
    thumbnail: "https://cdn.muapi.ai/data/2/874086171651/Screenshot_2026-04-15_103743.png",
    isTemplate: true
  },
  {
    name: "Seedance V2 Studio",
    description: "A premium AI art studio template concept with a credit-based access flow.",
    icon: FaMagic,
    color: "purple",
    thumbnail: "https://cdn.muapi.ai/apps/4cd1f49d48934d448e7f493f9d5e476e.png",
    isTemplate: true
  },
  {
    name: "AI Clipping Studio",
    description: "An AI video clipping template concept for extracting highlights from long videos.",
    icon: FaVideo,
    color: "emerald",
    thumbnail: "https://cdn.muapi.ai/data/2/883345778103/cca8b5bb-25f1-40fe-928e-53dce2c8c928.png",
    isTemplate: true
  },
  {
    name: "EasyVeo Studio",
    description: "A video generation suite template concept covering text-to-video and image-to-video flows.",
    icon: FaVideo,
    color: "indigo",
    thumbnail: "https://cdn.muapi.ai/data/2/901343404247/94ac6d86-be4e-4b70-b1e6-96d7e3692604.png",
    isTemplate: true
  }
];

const dummyAppsData = [
  { thumbnail: "https://cdn.muapi.ai/apps/Pet_Product_Studio.jpg", name: "Pet Product Studio", description: "High-end product photography specifically for pet toys and food.", icon: FaPaw, category: "Lifestyle" },
  { thumbnail: "https://cdn.muapi.ai/apps/Resale_Photo_Enhancer.png", name: "Resale Photo Enhancer", description: "Boost sales by elevating low-quality product photos to studio level.", icon: FaImage, category: "Business" },
  { thumbnail: "https://cdn.muapi.ai/apps/AI_Recruiter.png", name: "AI Recruiter", description: "Smart candidate screening and interview assistant.", icon: FaBriefcase, category: "Business" },
  { thumbnail: "https://cdn.muapi.ai/apps/Talk_to_PDF.png", name: "Talk to PDF", description: "Interactive document chat for deep research and summarization.", icon: FaFileAlt, category: "Productivity" },
  { thumbnail: "https://cdn.muapi.ai/apps/Blogger_CMS.png", name: "Blogger CMS", description: "AI-powered content management for high-velocity SEO blogs.", icon: FaBriefcase, category: "Business" },
  { thumbnail: "https://cdn.muapi.ai/apps/Amazon_Product_Studio.webp", name: "Amazon Product Studio", description: "Perfect Amazon-ready product shots with AI backdrops.", icon: FaImage, category: "Business" },
  { thumbnail: "https://cdn.muapi.ai/apps/AI_Business_Card.webp", name: "AI Business Card", description: "Digital-first business card generator with AI networking.", icon: FaBriefcase, category: "Business" },
  { thumbnail: "https://cdn.muapi.ai/apps/MailWise.png", name: "MailWise", description: "Intelligent email drafting and scheduling assistant.", icon: FaBriefcase, category: "Business" },
  { thumbnail: "https://cdn.muapi.ai/apps/My_Podcast.webp", name: "My Podcast", description: "Automated podcast editing and show-note generation.", icon: FaMicrophone, category: "Creative" },
  { thumbnail: "https://cdn.muapi.ai/apps/EZScribe.png", name: "EZScribe", description: "Instant transcription and meeting minute automation.", icon: FaFileAlt, category: "Productivity" },
  { thumbnail: "https://cdn.muapi.ai/apps/AI_Knowledge_Base.png", name: "AI Knowledge Base", description: "Train an AI on your company data for instant support.", icon: FaBriefcase, category: "Business" },
  { thumbnail: "https://cdn.muapi.ai/apps/AI_Outbound.webp", name: "AI Outbound", description: "Personalized cold outreach at scale for sales teams.", icon: FaBriefcase, category: "Business" },
  { thumbnail: "https://cdn.muapi.ai/apps/AI_Royal_Portrait.png", name: "AI Royal Portrait", description: "Transform your photos into 18th-century royal oil paintings.", icon: FaHandSparkles, category: "Creative" },
  { thumbnail: "https://cdn.muapi.ai/apps/AI_MEME.png", name: "AI MEME", description: "Viral-ready meme generation based on trending topics.", icon: FaMagic, category: "Creative" },
  { thumbnail: "https://cdn.muapi.ai/apps/AI_Real_Estate_Stager.webp", name: "AI Real Estate Stager", description: "Virtually furnish and stage empty homes for sale.", icon: FaHome, category: "Real Estate" },
  { thumbnail: "https://cdn.muapi.ai/apps/AI_Logo.png", name: "AI Logo", description: "Dynamic brand identity and logo generator.", icon: FaHandSparkles, category: "Business" },
  { thumbnail: "https://cdn.muapi.ai/apps/OldPhoto.png", name: "OldPhoto", description: "Restore, colorize, and sharpen vintage family photos.", icon: FaImage, category: "Creative" },
  { thumbnail: "https://cdn.muapi.ai/apps/AITryOn.png", name: "AITryOn", description: "Virtual fitting room for fashion brands and enthusiasts.", icon: FaHandSparkles, category: "Lifestyle" },
  { thumbnail: "https://cdn.muapi.ai/apps/AI_Age_Transformation.webp", name: "AI Age Transformation", description: "Visualize yourself at different stages of life with high fidelity.", icon: FaImage, category: "Lifestyle" },
  { thumbnail: "https://cdn.muapi.ai/apps/AI_Professional_Makeup_Generator.webp", name: "AI Professional Makeup Generator", description: "Try on hundreds of makeup looks virtually.", icon: FaHandSparkles, category: "Lifestyle" },
  { thumbnail: "https://cdn.muapi.ai/apps/AI_Flash_Cards.webp", name: "AI Flash Cards", description: "Turn any text or PDF into pedagogical flashcards.", icon: FaFileAlt, category: "Education" },
  { thumbnail: "https://cdn.muapi.ai/apps/AI_Group_Photo.webp", name: "AI Group Photo", description: "Seamlessly combine individual portraits into a group photo.", icon: FaImage, category: "Creative" },
  { thumbnail: "https://cdn.muapi.ai/apps/AI_Tattoo_Try_On.webp", name: "AI Tattoo Try-On", description: "Visualize tattoos on your body before getting inked.", icon: FaHandSparkles, category: "Lifestyle" },
  { thumbnail: "https://cdn.muapi.ai/apps/AI_Hair_Style_Simulator.webp", name: "AI Hair Style Simulator", description: "Try on new haircuts and colors with zero commitment.", icon: FaHandSparkles, category: "Lifestyle" },
  { thumbnail: "https://cdn.muapi.ai/apps/AI_Kids_to_Adult_Prediction.webp", name: "AI Kids-to-Adult Prediction", description: "Ever wonder what your kid will look like as an adult?", icon: FaImage, category: "Lifestyle" },
  { thumbnail: "https://cdn.muapi.ai/apps/AI_Room_Declutter.webp", name: "AI Room Declutter", description: "Instantly clean up messy room photos for listings.", icon: FaHome, category: "Real Estate" },
  { thumbnail: "https://cdn.muapi.ai/apps/AI_Fitness_Body_Simulator.webp", name: "AI Fitness Body Simulator", description: "Visualize your fitness goals on your own body.", icon: FaImage, category: "Lifestyle" },
  { thumbnail: "https://cdn.muapi.ai/apps/AI_Pet_Portrait.webp", name: "AI Pet Portrait", description: "Elegant, artistic portraits for your beloved pets.", icon: FaPaw, category: "Lifestyle" },
  { thumbnail: "https://cdn.muapi.ai/apps/AI_Kissing_Video_Generator.webp", name: "AI Kissing Video Generator", description: "Expressive AI video generation for romantic moments.", icon: FaVideo, category: "Creative" },
  { thumbnail: "https://cdn.muapi.ai/apps/Chat_with_PDF.webp", name: "Chat with PDF", description: "Ask questions and extract data from massive PDF files.", icon: FaFileAlt, category: "Productivity" },
  { thumbnail: "https://cdn.muapi.ai/apps/AI_Travel_Studio.png", name: "AI Travel Studio", description: "Create stunning travel posters and visuals from prompts.", icon: FaMapMarkerAlt, category: "Lifestyle" },
  { thumbnail: "https://cdn.muapi.ai/apps/Prompt_Architect.webp", name: "Prompt Architect", description: "Refine and optimize complex prompts for high-tier AI models.", icon: FaMagic, category: "Creative" },
  { thumbnail: "https://cdn.muapi.ai/apps/ClearMark_AI.webp", name: "ClearMark AI", description: "Automated watermark removal and brand cleanup for assets.", icon: FaImage, category: "Business" },
  { thumbnail: "https://cdn.muapi.ai/apps/PlantVision_AI.webp", name: "PlantVision AI", description: "Identify plants and generate gardening care guides.", icon: FaHandSparkles, category: "Lifestyle" },
  { thumbnail: "https://cdn.muapi.ai/apps/AI_Wedding_Photo.png", name: "AI Wedding Photo", description: "Cinematic wedding photography enhancements and filters.", icon: FaImage, category: "Lifestyle" },
  { thumbnail: "https://cdn.muapi.ai/apps/User_Account_Registration_Form.webp", name: "User Account Registration Form", description: "Beautiful, conversion-optimized signup flows.", icon: FaBriefcase, category: "Development" },
  { thumbnail: "https://cdn.muapi.ai/apps/Social_Post.webp", name: "Social Post", description: "AI-generated social media scheduling and copy creator.", icon: FaBriefcase, category: "Marketing" },
  { thumbnail: "https://cdn.muapi.ai/apps/MagicSelf_AI.webp", name: "MagicSelf AI", description: "The ultimate AI selfie and avatar generation engine.", icon: FaMagic, category: "Creative" },
  { thumbnail: "https://cdn.muapi.ai/apps/AI_Resume_Builder.webp", name: "AI Resume Builder", description: "Craft the perfect, ATS-friendly resume in seconds.", icon: FaFileAlt, category: "Productivity" },
  { thumbnail: "https://cdn.muapi.ai/apps/GEO_Checker.webp", name: "GEO Checker", description: "AI-powered location tagging and geodata validation.", icon: FaMapMarkerAlt, category: "Business" },
  { thumbnail: "https://cdn.muapi.ai/apps/AI_Character_Studio.webp", name: "AI Character Studio", description: "Consistent character design for animators and writers.", icon: FaUserTie, category: "Creative" },
  { thumbnail: "https://cdn.muapi.ai/apps/Luxury_Hair_Studio.webp", name: "Luxury Hair Studio", description: "High-end hair visualization for top-tier salons.", icon: FaHandSparkles, category: "Lifestyle" },
  { thumbnail: "https://cdn.muapi.ai/apps/ProFlow_Plumbing.webp", name: "ProFlow Plumbing", description: "AI scheduling and diagnostics for plumbing services.", icon: FaHome, category: "Services" },
  { thumbnail: "https://cdn.muapi.ai/apps/Solace_AI.webp", name: "Solace AI", description: "Empathetic AI assistant for mental well-being support.", icon: FaHandSparkles, category: "Health" },
  { thumbnail: "https://cdn.muapi.ai/apps/ReLive_AI.webp", name: "ReLive AI", description: "Immersive memory and historical visualization engine.", icon: FaHandSparkles, category: "Creative" },
  { thumbnail: "https://cdn.muapi.ai/apps/AI_Chiropractic_Service.webp", name: "AI Chiropractic Service", description: "Postural analysis and exercise recommendation AI.", icon: FaUserInjured, category: "Health" },
  { thumbnail: "https://cdn.muapi.ai/apps/Tabla___ReserveAI.webp", name: "Tabla - ReserveAI", description: "Intelligent table reservation engine for restaurants.", icon: FaBuilding, category: "Services" },
  { thumbnail: "https://cdn.muapi.ai/apps/Dental_ReserveAI.webp", name: "Dental ReserveAI", description: "Smart dental appointment and follow-up management.", icon: FaStethoscope, category: "Health" },
  { thumbnail: "https://cdn.muapi.ai/apps/CounselMate.webp", name: "CounselMate", description: "Legal research and document drafting aid for lawyers.", icon: FaBalanceScale, category: "Legal" },
  { thumbnail: "https://cdn.muapi.ai/apps/Intelligent_Real_Estate_Agent.webp", name: "Intelligent Real Estate Agent", description: "Automate leads and property matches with AI agents.", icon: FaHome, category: "Real Estate" },
  { thumbnail: "https://cdn.muapi.ai/apps/Fixera.webp", name: "Fixera", description: "Home repair diagnosis and pro-finding ecosystem.", icon: FaHome, category: "Services" },
  { thumbnail: "https://cdn.muapi.ai/apps/Velora___Yoga_AI.webp", name: "Velora - Yoga AI", description: "Personalized AI yoga and posture guidance engine.", icon: FaHandSparkles, category: "Health" },
  { thumbnail: "https://cdn.muapi.ai/apps/Nova_AssuranceAI.webp", name: "Nova AssuranceAI", description: "Smart insurance quote and claim processing assistant.", icon: FaBalanceScale, category: "Legal" },
  { thumbnail: "https://cdn.muapi.ai/apps/TurboGlow_Auto_Spa.webp", name: "TurboGlow Auto Spa", description: "AI booking and customization for luxury auto detailing.", icon: FaCar, category: "Services" },
  { thumbnail: "https://cdn.muapi.ai/apps/Paws___Pals.webp", name: "Paws & Pals", description: "AI-powered pet care and walking coordination hub.", icon: FaPaw, category: "Lifestyle" },
  { thumbnail: "https://cdn.muapi.ai/apps/Vertex_Tax_Strategy.webp", name: "Vertex Tax Strategy", description: "Intelligent tax planning and deduction spotting AI.", icon: FaBalanceScale, category: "Business" },
  { thumbnail: "https://cdn.muapi.ai/apps/LedgerSync.webp", name: "LedgerSync", description: "Automated bookkeeping and financial reconciliations.", icon: FaBriefcase, category: "Business" },
  { thumbnail: "https://cdn.muapi.ai/apps/Nova_Care_Clinic.webp", name: "Nova Care Clinic", description: "Patient scheduling and medical intake automation.", icon: FaStethoscope, category: "Health" },
  { thumbnail: "https://cdn.muapi.ai/apps/Opulent_Drive.webp", name: "Opulent Drive", description: "Luxury car rental and fleet management AI.", icon: FaCar, category: "Services" },
  { thumbnail: "https://cdn.muapi.ai/apps/ProFix_Auto.webp", name: "ProFix Auto", description: "Engine diagnostics and preventive maintenance alerts.", icon: FaCar, category: "Services" },
  { thumbnail: "https://cdn.muapi.ai/apps/TowMate.webp", name: "TowMate", description: "Smart roadside assistance and dispatch coordination.", icon: FaTruck, category: "Services" },
  { thumbnail: "https://cdn.muapi.ai/apps/SwiftLink_Logistics.webp", name: "SwiftLink Logistics", description: "AI route optimization and fleet tracking system.", icon: FaTruck, category: "Services" },
  { thumbnail: "https://cdn.muapi.ai/apps/Lumea_Residence.webp", name: "Lumea Residence", description: "Smart home property management and tenant portal.", icon: FaHome, category: "Real Estate" }
];

export default function AppsStudio({ apiKey, locale = 'en' }) {
  const copy = resolveCopy(en, APPS_MESSAGES, locale);
  const [selectedApp, setSelectedApp] = useState(null);
  const [isRequesting, setIsRequesting] = useState(false);
  const [requestedApps, setRequestedApps] = useState([]);

  useEffect(() => {
    if (apiKey) {
      getAppInterests(apiKey)
        .then(setRequestedApps)
        .catch(err => console.error("Error fetching interests:", err));
    }
  }, [apiKey]);

  useEffect(() => {
    if (!selectedApp) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') setSelectedApp(null);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedApp]);

  const handleRequestAccess = async () => {
    if (!selectedApp) return;
    if (!apiKey) {
      toast.error(copy.toast.requestError);
      return;
    }
    
    setIsRequesting(true);
    try {
      await registerAppInterest(apiKey, selectedApp.name);
      setRequestedApps(prev => [...prev, selectedApp.name]);
      toast.success(copy.toast.requestSuccess);
      setTimeout(() => setSelectedApp(null), 1500);
    } catch (error) {
      console.error(error);
      toast.error(copy.toast.requestError);
    } finally {
      setIsRequesting(false);
    }
  };

  const renderAppCard = (app, isDummy = false, index = 0) => {
    const requested = requestedApps.includes(app.name);
    // Premium Vibrant Gradients for placeholders
    const gradients = [
      "from-blue-600/20 to-indigo-600/20",
      "from-purple-600/20 to-pink-600/20",
      "from-amber-500/20 to-orange-600/20",
      "from-emerald-500/20 to-teal-600/20",
      "from-rose-500/20 to-red-600/20",
      "from-rose-500/20 to-purple-600/20",
    ];
    const cardGradient = gradients[index % gradients.length];
    
    return (
      <div 
        key={app.name}
        className="group bg-surface-glass/80 backdrop-blur-md border border-white/10 rounded-xl flex flex-col overflow-hidden transition-[border-color,background-color,box-shadow,transform] duration-smooth ease-card-hover hover:border-white/20 hover:bg-surface-glass/95 hover:shadow-elevation-3 hover:-translate-y-1"
      >
        {/* Thumbnail Section */}
        <div className="relative h-44 w-full overflow-hidden bg-white/5">
          {app.thumbnail ? (
            <img
              src={app.thumbnail}
              alt={app.name}
              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
            />
          ) : (
            <div className={`w-full h-full flex items-center justify-center bg-gradient-to-br ${cardGradient} transition-colors group-hover:scale-110 duration-700`}>
              <app.icon className={`text-4xl opacity-20 group-hover:opacity-40 transition-opacity text-white`} />
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-60 group-hover:opacity-80 transition-opacity" />
          {isDummy && (
            <span className="absolute left-3 top-3 rounded-full border border-white/20 bg-black/70 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-white/80 backdrop-blur-sm">
              {copy.card.demo || 'Coming soon'}
            </span>
          )}
        </div>

        {/* Content Section */}
        <div className="p-5 flex flex-col flex-1 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-lg text-[#e11d74] border border-white/5 group-hover:border-white/10 transition-colors">
              <app.icon />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-bold text-white uppercase tracking-tight truncate">{app.name}</h3>
              <p className="text-[10px] text-white/40 font-bold uppercase tracking-widest">{app.category || copy.card.templateFallback}</p>
            </div>
          </div>
          
          <p className="text-xs text-white/50 leading-relaxed font-medium line-clamp-2 min-h-[2.5rem]">{app.description}</p>
          
          {/* Action Buttons */}
          <div className="flex items-center gap-2 pt-2">
            <button
              onClick={() => setSelectedApp({ ...app, isDummy })}
              disabled={requested}
              className="flex-1 py-2 bg-white/5 text-white rounded-md text-[11px] font-bold uppercase tracking-wider flex items-center justify-center gap-2 hover:bg-white/10 active:scale-[0.98] active:duration-instant transition-[background-color,transform] duration-fast ease-standard border border-white/10 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand-ring cursor-pointer disabled:opacity-50 disabled:pointer-events-none"
            >
              <FaRocket className="text-xs text-[#e11d74]" />
              {requested ? (copy.card.requested || '已登记') : isDummy ? (copy.card.reserve || '预约通知') : (copy.card.getTemplate || '登记意向')}
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="h-full w-full flex flex-col items-center bg-transparent overflow-y-auto custom-scrollbar relative">
      <Toaster position="bottom-right" reverseOrder={false} />
      
      <div className="flex flex-col gap-10 items-center w-full max-w-7xl pt-12 pb-24 px-6">
        
        {/* Header Section */}
        <div className="text-center space-y-6 max-w-3xl">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-[#e11d74]/10 border border-[#e11d74]/20 rounded-full">
            <FaMagic className="text-[#e11d74] text-xs" />
            <span className="text-[10px] font-black text-[#e11d74] uppercase tracking-widest">{copy.hero.badge}</span>
          </div>
          <h1 className="text-5xl font-black text-white tracking-tighter leading-[0.9]">
            {copy.hero.titleLine1}<br />{copy.hero.titleLine2}
          </h1>
          <p className="text-white/40 text-sm font-medium leading-relaxed max-w-xl mx-auto">
            {copy.hero.subtitle}
          </p>
        </div>

        {/* Apps Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 w-full pt-8">
          {templateApps.map((app, index) => renderAppCard(app, false, index))}
          {dummyAppsData.map((app, index) => renderAppCard(app, true, index + templateApps.length))}
        </div>

        {/* Footer Accent */}
        <div className="pt-24 pb-12 flex flex-col items-center gap-4">
          <div className="inline-flex items-center gap-3 px-4 py-2 bg-white/5 rounded-full border border-white/5">
            <span className="block w-1.5 h-1.5 rounded-full bg-[#e11d74] animate-pulse" />
            <span className="text-[9px] font-black text-white/40 uppercase tracking-widest">{copy.footer.moreComingSoon}</span>
          </div>
        </div>
      </div>

      {/* Get Template Modal */}
      {selectedApp && (
        <div 
          className="fixed inset-0 z-modal flex items-center justify-center p-4 bg-scrim backdrop-blur-xl animate-in fade-in duration-modal ease-enter"
          onClick={() => setSelectedApp(null)}
          role="dialog"
          aria-modal="true"
        >
          <div 
            className="relative bg-overlay border border-line w-full max-w-md rounded-2xl p-6 sm:p-8 space-y-6 shadow-elevation-4 animate-scale-in text-ink"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex flex-col items-center text-center space-y-3">
              <div className="w-16 h-16 rounded-2xl bg-brand/10 border border-brand/20 flex items-center justify-center text-3xl text-brand mb-1">
                <selectedApp.icon />
              </div>
              <h2 className="text-xl font-bold text-ink uppercase tracking-tight">
                {copy.modal.deployTitle.replace('{appName}', selectedApp.name)}
              </h2>
              <p className="text-xs text-ink-muted leading-relaxed px-2">
                {copy.modal.body.split('{appName}').map((part, i, arr) => (
                  <React.Fragment key={i}>
                    {part}
                    {i < arr.length - 1 && <b className="text-ink font-semibold">{selectedApp.name}</b>}
                  </React.Fragment>
                ))}
              </p>
            </div>

            <div className="space-y-2.5 pt-2 border-t border-line">
              <button
                type="button"
                onClick={handleRequestAccess}
                disabled={isRequesting}
                className="w-full py-3 bg-brand hover:bg-brand-hover active:bg-brand-active active:scale-[0.98] active:duration-instant text-ink-on-accent font-semibold rounded-xl text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-[background-color,transform] duration-fast ease-standard cursor-pointer shadow-elevation-1 disabled:opacity-50 disabled:pointer-events-none focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand-ring"
              >
                {isRequesting ? copy.modal.sending : copy.modal.getTemplate}
              </button>
              <button
                type="button"
                onClick={() => setSelectedApp(null)}
                className="w-full py-2.5 bg-well hover:bg-raised border border-line text-ink-muted hover:text-ink rounded-xl text-xs font-semibold uppercase tracking-wider flex items-center justify-center gap-2 active:scale-[0.98] active:duration-instant transition-[background-color,color,transform] duration-fast ease-standard cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand-ring"
              >
                {copy.modal.maybeLater}
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes scaleUp {
          from { opacity: 0; transform: scale(0.95) translateY(10px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }
        .animate-fade-in { animation: fadeIn 0.3s ease-out; }
        .animate-scale-up { animation: scaleUp 0.3s cubic-bezier(0.16, 1, 0.3, 1); }
      `}</style>
    </div>
  );
}
