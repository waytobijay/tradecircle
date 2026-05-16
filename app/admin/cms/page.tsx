/**
 * app/admin/cms/page.tsx
 * CMS — Blog Posts, FAQ Manager, Static Pages, Announcements.
 * Spec ref: section 6.7 (Admin Portal — CMS)
 */

'use client';

import { useCallback, useRef, useState } from 'react';
import AdminLayout from '@/components/layouts/AdminLayout';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '@/services/firebase';
import {
  Plus, Edit2, Trash2, ChevronDown, ChevronUp, X, Save, CheckCircle,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

type CmsTab = 'blog' | 'faq' | 'pages' | 'announcements';

interface BlogPost {
  id:        string;
  title:     string;
  slug:      string;
  body:      string;
  category:  string;
  tags:      string;
  published: boolean;
  date:      string;
  author:    string;
}

type FaqCategory = 'Account' | 'Buying' | 'Selling' | 'Payments' | 'Advisors';
interface Faq {
  id:       string;
  question: string;
  answer:   string;
  category: FaqCategory;
}

type PageSlug = 'about' | 'privacy' | 'terms' | 'cookies' | 'refund';
interface StaticPage { slug: PageSlug; label: string; content: string }

type AnnouncementType = 'Info' | 'Warning' | 'Success';
interface Announcement {
  message:   string;
  type:      AnnouncementType;
  startDate: string;
  endDate:   string;
  active:    boolean;
}

// ─── Mock data ────────────────────────────────────────────────────────────────

const INIT_POSTS: BlogPost[] = [
  { id: '1', title: 'Welcome to TradeCircle', slug: 'welcome-to-tradecircle', body: 'We are thrilled to launch the TradeCircle platform...', category: 'News', tags: 'launch, platform', published: true,  date: '2024-01-15', author: 'Admin' },
  { id: '2', title: '5 Tips for Sellers',     slug: '5-tips-for-sellers',     body: 'Maximise your sales by following these simple steps...', category: 'Tips',  tags: 'selling, tips', published: true,  date: '2024-02-03', author: 'Admin' },
  { id: '3', title: 'New Payment Methods',    slug: 'new-payment-methods',    body: 'We have added eSewa, Khalti, and Fonepay...', category: 'Updates', tags: 'payments', published: false, date: '2024-03-20', author: 'Admin' },
];

const INIT_FAQS: Faq[] = [
  { id: 'f1',  question: 'How do I create an account?', answer: 'Click "Sign Up" on the homepage and follow the prompts. You can register as a Buyer, Seller, or Advisor.', category: 'Account' },
  { id: 'f2',  question: 'Can I change my role?',       answer: 'Yes. Go to Settings → Profile → Role and select a new role. Some features require admin approval.', category: 'Account' },
  { id: 'f3',  question: 'How do I contact a seller?',  answer: 'Open any product listing and click "Contact Seller". You\'ll need an account to send a message.', category: 'Buying' },
  { id: 'f4',  question: 'Is it safe to buy?',          answer: 'Yes. We use industry-standard encryption and escrow-style payment flows. Always review seller ratings.', category: 'Buying' },
  { id: 'f5',  question: 'What payments are accepted?', answer: 'We accept Stripe, eWAY, eSewa, Khalti, and Fonepay depending on your region.', category: 'Buying' },
  { id: 'f6',  question: 'How do I list a product?',    answer: 'Log in as a Seller, go to My Products → New Listing, fill in the details and publish.', category: 'Selling' },
  { id: 'f7',  question: 'How many photos per product?', answer: 'Up to 5 photos per listing. High-quality images increase buyer confidence.', category: 'Selling' },
  { id: 'f8',  question: 'Can I edit after publishing?', answer: 'Yes. Open the listing in My Products and click Edit at any time.', category: 'Selling' },
  { id: 'f9',  question: 'What currencies?',             answer: 'AUD, USD, NPR, and INR are supported. Prices convert automatically at current rates.', category: 'Payments' },
  { id: 'f10', question: 'Are payments secure?',         answer: 'All transactions are encrypted. We do not store card details; that is handled by PCI-compliant gateways.', category: 'Payments' },
  { id: 'f11', question: 'What is an Advisor?',          answer: 'Advisors are verified experts who publish tips, guides, and advice posts. Buyers can contact them directly.', category: 'Advisors' },
];

const FAQ_CATEGORIES: FaqCategory[] = ['Account', 'Buying', 'Selling', 'Payments', 'Advisors'];

const INIT_PAGES: StaticPage[] = [
  { slug: 'about',   label: 'About',         content: 'TradeCircle is a community-first marketplace...' },
  { slug: 'privacy', label: 'Privacy Policy', content: 'Your privacy is important to us. This policy explains what data we collect...' },
  { slug: 'terms',   label: 'Terms',          content: 'By using TradeCircle you agree to our terms of service...' },
  { slug: 'cookies', label: 'Cookie Policy',  content: 'We use cookies to improve your experience...' },
  { slug: 'refund',  label: 'Refund Policy',  content: 'Refunds are processed within 5–7 business days...' },
];

const INIT_ANNOUNCEMENT: Announcement = {
  message: 'Welcome to TradeCircle! Explore thousands of listings from local sellers.',
  type: 'Info',
  startDate: '2024-01-01',
  endDate: '2024-12-31',
  active: true,
};

function slugify(str: string) {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function uid() { return Math.random().toString(36).slice(2); }

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AdminCmsPage() {
  const [activeTab, setActiveTab] = useState<CmsTab>('blog');

  // Blog state
  const [posts,       setPosts]       = useState<BlogPost[]>(INIT_POSTS);
  const [editingPost, setEditingPost] = useState<BlogPost | null>(null);
  const [showPostForm, setShowPostForm] = useState(false);
  const [postForm,    setPostForm]    = useState<Omit<BlogPost, 'id' | 'date' | 'author'>>({
    title: '', slug: '', body: '', category: '', tags: '', published: false,
  });

  // FAQ state
  const [faqs,        setFaqs]        = useState<Faq[]>(INIT_FAQS);
  const [faqTab,      setFaqTab]      = useState<FaqCategory>('Account');
  const [openFaqId,   setOpenFaqId]   = useState<string | null>(null);
  const [showFaqForm, setShowFaqForm] = useState(false);
  const [faqForm,     setFaqForm]     = useState<Omit<Faq, 'id'>>({ question: '', answer: '', category: 'Account' });

  // Pages state
  const [pages,         setPages]         = useState<StaticPage[]>(INIT_PAGES);
  const [selectedPage,  setSelectedPage]  = useState<PageSlug | null>(null);
  const [pageContent,   setPageContent]   = useState('');
  const [savingPage,    setSavingPage]     = useState(false);

  // Announcements state
  const [announcement, setAnnouncement] = useState<Announcement>(INIT_ANNOUNCEMENT);
  const [savingAnn,    setSavingAnn]    = useState(false);

  // Toast
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showToast = useCallback((msg: string) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 3000);
  }, []);

  // ── Blog helpers ───────────────────────────────────────────────────────────

  function openNewPost() {
    setEditingPost(null);
    setPostForm({ title: '', slug: '', body: '', category: '', tags: '', published: false });
    setShowPostForm(true);
  }

  function openEditPost(post: BlogPost) {
    setEditingPost(post);
    setPostForm({ title: post.title, slug: post.slug, body: post.body, category: post.category, tags: post.tags, published: post.published });
    setShowPostForm(true);
  }

  function savePost() {
    if (!postForm.title.trim()) return;
    if (editingPost) {
      setPosts((prev) => prev.map((p) => p.id === editingPost.id ? { ...editingPost, ...postForm } : p));
    } else {
      const newPost: BlogPost = {
        id: uid(), date: new Date().toISOString().split('T')[0], author: 'Admin', ...postForm,
      };
      setPosts((prev) => [newPost, ...prev]);
    }
    setShowPostForm(false);
  }

  function deletePost(id: string) {
    setPosts((prev) => prev.filter((p) => p.id !== id));
  }

  // ── FAQ helpers ────────────────────────────────────────────────────────────

  function addFaq() {
    if (!faqForm.question.trim() || !faqForm.answer.trim()) return;
    setFaqs((prev) => [...prev, { id: uid(), ...faqForm }]);
    setFaqForm({ question: '', answer: '', category: faqTab });
    setShowFaqForm(false);
  }

  function deleteFaq(id: string) {
    setFaqs((prev) => prev.filter((f) => f.id !== id));
  }

  // ── Pages helpers ──────────────────────────────────────────────────────────

  function selectPage(slug: PageSlug) {
    const pg = pages.find((p) => p.slug === slug);
    if (pg) { setSelectedPage(slug); setPageContent(pg.content); }
  }

  async function publishPage() {
    if (!selectedPage) return;
    setSavingPage(true);
    try {
      setPages((prev) => prev.map((p) => p.slug === selectedPage ? { ...p, content: pageContent } : p));
      await setDoc(doc(db, 'staticPages', selectedPage), { content: pageContent, updatedAt: new Date().toISOString() }, { merge: true });
      showToast('Page published successfully.');
    } catch {
      showToast('Failed to publish. Please try again.');
    } finally { setSavingPage(false); }
  }

  // ── Announcement helpers ───────────────────────────────────────────────────

  async function saveAnnouncement() {
    setSavingAnn(true);
    try {
      await setDoc(doc(db, 'config', 'siteConfig.announcement'), announcement, { merge: true });
      showToast('Announcement saved.');
    } catch {
      showToast('Failed to save. Please try again.');
    } finally { setSavingAnn(false); }
  }

  function deactivateAnnouncement() {
    setAnnouncement((a) => ({ ...a, active: false }));
  }

  // ─── Styles ────────────────────────────────────────────────────────────────

  const TAB_ITEMS: { value: CmsTab; label: string }[] = [
    { value: 'blog',          label: 'Blog Posts'    },
    { value: 'faq',           label: 'FAQ Manager'   },
    { value: 'pages',         label: 'Static Pages'  },
    { value: 'announcements', label: 'Announcements' },
  ];

  const ANN_TYPES: AnnouncementType[] = ['Info', 'Warning', 'Success'];
  const annTypeColor: Record<AnnouncementType, string> = {
    Info: 'var(--color-primary)', Warning: 'var(--color-warning)', Success: 'var(--color-success)',
  };

  const filteredFaqs = faqs.filter((f) => f.category === faqTab);

  return (
    <AdminLayout>
      <div style={{ padding: '28px 24px', maxWidth: 1100 }}>

        <style>{`
          .cms-card {
            background: var(--color-surface);
            border: 1px solid var(--color-border);
            border-radius: 12px;
            padding: 22px 24px;
          }
          .cms-label {
            display: block; font-size: 12px; font-weight: 600;
            color: var(--color-text-secondary); margin-bottom: 6px;
            text-transform: uppercase; letter-spacing: 0.04em;
          }
          .cms-input {
            width: 100%; padding: 9px 12px; border-radius: 8px;
            border: 1px solid var(--color-border);
            background: var(--color-background); color: var(--color-text);
            font-size: 13px; box-sizing: border-box;
          }
          .cms-input:focus { outline: 2px solid var(--color-primary); outline-offset: -1px; }
          .cms-table { width: 100%; border-collapse: collapse; font-size: 13px; }
          .cms-table th {
            text-align: left; padding: 9px 12px;
            font-size: 11px; font-weight: 700; text-transform: uppercase;
            letter-spacing: 0.05em; color: var(--color-text-secondary);
            border-bottom: 1px solid var(--color-border);
          }
          .cms-table td {
            padding: 12px 12px; border-bottom: 1px solid var(--color-border);
            color: var(--color-text); vertical-align: middle;
          }
          .cms-table tr:last-child td { border-bottom: none; }
          .cms-table tr:hover td { background: color-mix(in srgb, var(--color-primary) 3%, transparent); }
          .cms-btn {
            display: inline-flex; align-items: center; gap: 6px;
            padding: 7px 14px; border-radius: 8px; font-size: 13px; font-weight: 600;
            cursor: pointer; border: none; transition: opacity 0.15s;
          }
          .cms-btn:hover { opacity: 0.85; }
          .cms-btn-primary { background: var(--color-primary); color: #fff; }
          .cms-btn-ghost {
            background: transparent; color: var(--color-text-secondary);
            border: 1px solid var(--color-border) !important;
          }
          .cms-btn-sm { padding: 5px 10px; font-size: 12px; border-radius: 6px; }
          .cms-faq-row {
            border: 1px solid var(--color-border); border-radius: 8px;
            overflow: hidden; margin-bottom: 8px;
          }
          .cms-faq-q {
            display: flex; align-items: center; justify-content: space-between;
            padding: 12px 16px; cursor: pointer;
            font-size: 13px; font-weight: 600; color: var(--color-text);
            background: var(--color-surface); gap: 12px;
          }
          .cms-faq-a {
            padding: 12px 16px; font-size: 13px; line-height: 1.6;
            color: var(--color-text-secondary); border-top: 1px solid var(--color-border);
            background: var(--color-background);
          }
          .cms-page-btn {
            padding: 10px 18px; border-radius: 8px; font-size: 13px; font-weight: 600;
            cursor: pointer; border: 1px solid var(--color-border); transition: all 0.15s;
          }
        `}</style>

        {/* Header */}
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--color-text)', margin: 0 }}>CMS</h1>
          <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginTop: 4 }}>
            Manage blog posts, FAQs, static pages, and announcements
          </p>
        </div>

        {/* Tab nav */}
        <div style={{
          display: 'flex', gap: 6, marginBottom: 24,
          background: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          borderRadius: 10, padding: 4, width: 'fit-content', flexWrap: 'wrap',
        }}>
          {TAB_ITEMS.map((t) => (
            <button
              key={t.value}
              onClick={() => setActiveTab(t.value)}
              style={{
                padding: '6px 18px', borderRadius: 7, border: 'none', cursor: 'pointer',
                fontSize: 13, fontWeight: 600,
                background: activeTab === t.value ? 'var(--color-primary)' : 'transparent',
                color: activeTab === t.value ? '#fff' : 'var(--color-text-secondary)',
                transition: 'all 0.15s',
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* ── Tab 1: Blog Posts ──────────────────────────────────────────────── */}
        {activeTab === 'blog' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
              <button className="cms-btn cms-btn-primary" onClick={openNewPost}>
                <Plus size={15} /> New Post
              </button>
            </div>

            <div className="cms-card" style={{ marginBottom: showPostForm ? 16 : 0 }}>
              <div style={{ overflowX: 'auto' }}>
                <table className="cms-table">
                  <thead>
                    <tr>
                      <th>Title</th>
                      <th>Author</th>
                      <th>Status</th>
                      <th>Date</th>
                      <th style={{ textAlign: 'center' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {posts.map((post) => (
                      <tr key={post.id}>
                        <td style={{ fontWeight: 500 }}>{post.title}</td>
                        <td style={{ color: 'var(--color-text-secondary)' }}>{post.author}</td>
                        <td>
                          <span style={{
                            padding: '3px 9px', borderRadius: 99, fontSize: 11, fontWeight: 700,
                            background: post.published
                              ? 'color-mix(in srgb, var(--color-success) 12%, transparent)'
                              : 'var(--color-border)',
                            color: post.published ? 'var(--color-success)' : 'var(--color-text-secondary)',
                          }}>
                            {post.published ? 'Published' : 'Draft'}
                          </span>
                        </td>
                        <td style={{ color: 'var(--color-text-secondary)', whiteSpace: 'nowrap' }}>{post.date}</td>
                        <td>
                          <div style={{ display: 'flex', justifyContent: 'center', gap: 6 }}>
                            <button className="cms-btn cms-btn-ghost cms-btn-sm" onClick={() => openEditPost(post)} title="Edit">
                              <Edit2 size={13} />
                            </button>
                            <button
                              className="cms-btn cms-btn-sm"
                              style={{ background: 'color-mix(in srgb, var(--color-danger) 10%, transparent)', color: 'var(--color-danger)', border: 'none' }}
                              onClick={() => deletePost(post.id)} title="Delete"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Post form panel */}
            {showPostForm && (
              <div className="cms-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                  <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--color-text)', margin: 0 }}>
                    {editingPost ? 'Edit Post' : 'New Post'}
                  </h3>
                  <button onClick={() => setShowPostForm(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-secondary)' }}>
                    <X size={18} />
                  </button>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
                  <div>
                    <label className="cms-label">Title *</label>
                    <input
                      className="cms-input"
                      value={postForm.title}
                      onChange={(e) => setPostForm((f) => ({ ...f, title: e.target.value, slug: slugify(e.target.value) }))}
                      placeholder="Post title"
                    />
                  </div>
                  <div>
                    <label className="cms-label">Slug</label>
                    <input
                      className="cms-input"
                      value={postForm.slug}
                      onChange={(e) => setPostForm((f) => ({ ...f, slug: e.target.value }))}
                      placeholder="auto-from-title"
                    />
                  </div>
                </div>
                <div style={{ marginBottom: 14 }}>
                  <label className="cms-label">Body</label>
                  <textarea
                    className="cms-input"
                    rows={6}
                    value={postForm.body}
                    onChange={(e) => setPostForm((f) => ({ ...f, body: e.target.value }))}
                    placeholder="Write your post content here…"
                    style={{ resize: 'vertical' }}
                  />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
                  <div>
                    <label className="cms-label">Category</label>
                    <input className="cms-input" value={postForm.category} onChange={(e) => setPostForm((f) => ({ ...f, category: e.target.value }))} placeholder="News" />
                  </div>
                  <div>
                    <label className="cms-label">Tags (comma-separated)</label>
                    <input className="cms-input" value={postForm.tags} onChange={(e) => setPostForm((f) => ({ ...f, tags: e.target.value }))} placeholder="launch, update" />
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
                  <input
                    type="checkbox"
                    id="pub-toggle"
                    checked={postForm.published}
                    onChange={(e) => setPostForm((f) => ({ ...f, published: e.target.checked }))}
                  />
                  <label htmlFor="pub-toggle" style={{ fontSize: 13, color: 'var(--color-text)', cursor: 'pointer' }}>
                    Published
                  </label>
                </div>
                <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                  <button className="cms-btn cms-btn-ghost" onClick={() => setShowPostForm(false)}>Cancel</button>
                  <button className="cms-btn cms-btn-primary" onClick={savePost}>Save Post</button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Tab 2: FAQ Manager ────────────────────────────────────────────── */}
        {activeTab === 'faq' && (
          <div>
            {/* Category sub-tabs */}
            <div style={{ display: 'flex', gap: 6, marginBottom: 20, flexWrap: 'wrap' }}>
              {FAQ_CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  onClick={() => { setFaqTab(cat); setOpenFaqId(null); setShowFaqForm(false); setFaqForm((f) => ({ ...f, category: cat })); }}
                  style={{
                    padding: '6px 16px', borderRadius: 8, border: '1px solid var(--color-border)', cursor: 'pointer',
                    fontSize: 13, fontWeight: 600,
                    background: faqTab === cat ? 'var(--color-primary)' : 'var(--color-surface)',
                    color: faqTab === cat ? '#fff' : 'var(--color-text-secondary)',
                    transition: 'all 0.15s',
                  }}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* FAQ list */}
            <div style={{ marginBottom: 16 }}>
              {filteredFaqs.length === 0 && (
                <div style={{ padding: '32px', textAlign: 'center', color: 'var(--color-text-secondary)', fontSize: 13 }}>
                  No FAQs in this category.
                </div>
              )}
              {filteredFaqs.map((faq) => (
                <div key={faq.id} className="cms-faq-row">
                  <div className="cms-faq-q" onClick={() => setOpenFaqId((v) => v === faq.id ? null : faq.id)}>
                    <span style={{ flex: 1 }}>{faq.question}</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                      <button
                        className="cms-btn cms-btn-sm"
                        style={{ background: 'color-mix(in srgb, var(--color-danger) 10%, transparent)', color: 'var(--color-danger)', border: 'none' }}
                        onClick={(e) => { e.stopPropagation(); deleteFaq(faq.id); }}
                        title="Delete"
                      >
                        <Trash2 size={12} />
                      </button>
                      {openFaqId === faq.id ? <ChevronUp size={16} color="var(--color-text-secondary)" /> : <ChevronDown size={16} color="var(--color-text-secondary)" />}
                    </div>
                  </div>
                  {openFaqId === faq.id && (
                    <div className="cms-faq-a">{faq.answer}</div>
                  )}
                </div>
              ))}
            </div>

            {/* Add FAQ */}
            {!showFaqForm ? (
              <button
                className="cms-btn cms-btn-primary"
                onClick={() => { setShowFaqForm(true); setFaqForm({ question: '', answer: '', category: faqTab }); }}
              >
                <Plus size={15} /> Add FAQ
              </button>
            ) : (
              <div className="cms-card">
                <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--color-text)', marginBottom: 16, marginTop: 0 }}>Add FAQ</h3>
                <div style={{ marginBottom: 12 }}>
                  <label className="cms-label">Question *</label>
                  <input className="cms-input" value={faqForm.question} onChange={(e) => setFaqForm((f) => ({ ...f, question: e.target.value }))} placeholder="What is…?" />
                </div>
                <div style={{ marginBottom: 12 }}>
                  <label className="cms-label">Answer *</label>
                  <textarea className="cms-input" rows={4} value={faqForm.answer} onChange={(e) => setFaqForm((f) => ({ ...f, answer: e.target.value }))} placeholder="The answer…" style={{ resize: 'vertical' }} />
                </div>
                <div style={{ marginBottom: 16 }}>
                  <label className="cms-label">Category</label>
                  <select className="cms-input" value={faqForm.category} onChange={(e) => setFaqForm((f) => ({ ...f, category: e.target.value as FaqCategory }))} style={{ width: 'auto' }}>
                    {FAQ_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                  <button className="cms-btn cms-btn-ghost" onClick={() => setShowFaqForm(false)}>Cancel</button>
                  <button className="cms-btn cms-btn-primary" onClick={addFaq}>Add</button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Tab 3: Static Pages ───────────────────────────────────────────── */}
        {activeTab === 'pages' && (
          <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr', gap: 20 }}>
            {/* Page list */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {pages.map((pg) => (
                <button
                  key={pg.slug}
                  className="cms-page-btn"
                  onClick={() => selectPage(pg.slug)}
                  style={{
                    background: selectedPage === pg.slug ? 'var(--color-primary)' : 'var(--color-surface)',
                    color: selectedPage === pg.slug ? '#fff' : 'var(--color-text)',
                    borderColor: selectedPage === pg.slug ? 'var(--color-primary)' : 'var(--color-border)',
                    textAlign: 'left',
                  }}
                >
                  {pg.label}
                </button>
              ))}
            </div>

            {/* Editor */}
            {selectedPage ? (
              <div className="cms-card">
                <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--color-text)', marginBottom: 14, marginTop: 0 }}>
                  {pages.find((p) => p.slug === selectedPage)?.label}
                </h3>
                <textarea
                  className="cms-input"
                  rows={14}
                  value={pageContent}
                  onChange={(e) => setPageContent(e.target.value)}
                  style={{ resize: 'vertical', fontFamily: 'monospace', fontSize: 12 }}
                />
                <div style={{ marginTop: 14, display: 'flex', justifyContent: 'flex-end' }}>
                  <button
                    className="cms-btn cms-btn-primary"
                    onClick={publishPage}
                    disabled={savingPage}
                    style={{ opacity: savingPage ? 0.6 : 1 }}
                  >
                    <Save size={14} />
                    {savingPage ? 'Publishing…' : 'Publish'}
                  </button>
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text-secondary)', fontSize: 14 }}>
                Select a page to edit
              </div>
            )}
          </div>
        )}

        {/* ── Tab 4: Announcements ──────────────────────────────────────────── */}
        {activeTab === 'announcements' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

            {/* Current active announcement */}
            {announcement.active && (
              <div className="cms-card" style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-text-secondary)' }}>ACTIVE ANNOUNCEMENT</span>
                    <span style={{
                      padding: '2px 9px', borderRadius: 99, fontSize: 11, fontWeight: 700,
                      background: `color-mix(in srgb, ${annTypeColor[announcement.type]} 12%, transparent)`,
                      color: annTypeColor[announcement.type],
                    }}>
                      {announcement.type}
                    </span>
                  </div>
                  <p style={{ fontSize: 14, color: 'var(--color-text)', margin: '0 0 8px' }}>{announcement.message}</p>
                  <p style={{ fontSize: 12, color: 'var(--color-text-secondary)', margin: 0 }}>
                    {announcement.startDate} — {announcement.endDate}
                  </p>
                </div>
                <button
                  className="cms-btn cms-btn-ghost cms-btn-sm"
                  onClick={deactivateAnnouncement}
                  style={{ whiteSpace: 'nowrap' }}
                >
                  Deactivate
                </button>
              </div>
            )}

            {/* Create / Edit form */}
            <div className="cms-card">
              <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--color-text)', marginBottom: 18, marginTop: 0 }}>
                {announcement.active ? 'Edit Announcement' : 'Create Announcement'}
              </h3>

              <div style={{ marginBottom: 14 }}>
                <label className="cms-label">Message</label>
                <textarea
                  className="cms-input"
                  rows={3}
                  value={announcement.message}
                  onChange={(e) => setAnnouncement((a) => ({ ...a, message: e.target.value }))}
                  placeholder="Announcement message…"
                  style={{ resize: 'vertical' }}
                />
              </div>

              <div style={{ marginBottom: 14 }}>
                <label className="cms-label">Type</label>
                <div style={{ display: 'flex', gap: 10 }}>
                  {ANN_TYPES.map((type) => (
                    <div
                      key={type}
                      onClick={() => setAnnouncement((a) => ({ ...a, type }))}
                      style={{
                        padding: '7px 16px', borderRadius: 8, cursor: 'pointer',
                        border: `1.5px solid ${announcement.type === type ? annTypeColor[type] : 'var(--color-border)'}`,
                        background: announcement.type === type ? `color-mix(in srgb, ${annTypeColor[type]} 10%, transparent)` : 'transparent',
                        color: announcement.type === type ? annTypeColor[type] : 'var(--color-text)',
                        fontSize: 13, fontWeight: 600, transition: 'all 0.15s',
                      }}
                    >
                      {type}
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
                <div>
                  <label className="cms-label">Start Date</label>
                  <input className="cms-input" type="date" value={announcement.startDate} onChange={(e) => setAnnouncement((a) => ({ ...a, startDate: e.target.value }))} />
                </div>
                <div>
                  <label className="cms-label">End Date</label>
                  <input className="cms-input" type="date" value={announcement.endDate} onChange={(e) => setAnnouncement((a) => ({ ...a, endDate: e.target.value }))} />
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
                <input
                  type="checkbox"
                  id="ann-active"
                  checked={announcement.active}
                  onChange={(e) => setAnnouncement((a) => ({ ...a, active: e.target.checked }))}
                />
                <label htmlFor="ann-active" style={{ fontSize: 13, color: 'var(--color-text)', cursor: 'pointer' }}>
                  Active
                </label>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button
                  className="cms-btn cms-btn-primary"
                  onClick={saveAnnouncement}
                  disabled={savingAnn}
                  style={{ opacity: savingAnn ? 0.6 : 1 }}
                >
                  <CheckCircle size={14} />
                  {savingAnn ? 'Saving…' : 'Save Announcement'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Toast */}
        {toast && (
          <div style={{
            position: 'fixed', bottom: 24, right: 24,
            background: 'var(--color-surface)', border: '1px solid var(--color-border)',
            borderRadius: 10, padding: '12px 20px', fontSize: 13, color: 'var(--color-text)',
            boxShadow: '0 8px 24px rgba(0,0,0,0.12)', zIndex: 9999,
          }}>
            {toast}
          </div>
        )}

      </div>
    </AdminLayout>
  );
}
