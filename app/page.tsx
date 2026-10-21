'use client';

import { ArrowLeft, Bookmark, Check, ChevronRight, Compass, Heart, MapPin, Menu, Search, Settings, UserRound, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import catalogue from './catalogue.demo.json';
import { captureAnalytics } from './analytics';

type Deal = typeof catalogue.deals[number];
type View = 'home' | 'search' | 'saved' | 'map' | 'account';
const deals = catalogue.deals;
const categories = Array.from(new Set(deals.map(deal => deal.category))).slice(0, 8).map(name => ({ name, image: deals.find(deal => deal.category === name)!.image }));
const navigation: { label: string; view: View; Icon: typeof Compass }[] = [
  { label: 'Save', view: 'home', Icon: Compass },
  { label: 'Explore offers', view: 'search', Icon: Search },
  { label: 'Saved', view: 'saved', Icon: Bookmark },
  { label: 'Map', view: 'map', Icon: MapPin },
  { label: 'My account', view: 'account', Icon: UserRound },
];

export default function HomePage() {
  const [view, setView] = useState<View>('home');
  const [menuOpen, setMenuOpen] = useState(false);
  const [selected, setSelected] = useState<Deal | null>(null);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('All');
  const [saved, setSaved] = useState<number[]>([]);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      try { const value = JSON.parse(localStorage.getItem('kouponly-saved') || '[]'); if (Array.isArray(value)) setSaved(value.filter((id): id is number => typeof id === 'number')); } catch { /* Keep a fresh list. */ }
      setReady(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);
  useEffect(() => {
    captureAnalytics('screen_viewed', { screen: selected ? 'offer_details' : view });
    if (selected) captureAnalytics('offer_viewed', { offer_id: selected.id, category: selected.category });
  }, [view, selected]);
  useEffect(() => { if (ready) { try { localStorage.setItem('kouponly-saved', JSON.stringify(saved)); } catch { /* Saving still works for this session. */ } } }, [saved, ready]);
  const results = useMemo(() => deals.filter(deal => (category === 'All' || category === deal.category) && `${deal.name} ${deal.place} ${deal.category} ${deal.offer}`.toLowerCase().includes(query.trim().toLowerCase())), [category, query]);
  const savedDeals = deals.filter(deal => saved.includes(deal.id));
  const go = (next: View) => { setView(next); setSelected(null); setMenuOpen(false); window.scrollTo({ top: 0, behavior: 'smooth' }); };
  const toggleSaved = (id: number) => {
    const deal = deals.find(item => item.id === id);
    if (deal) captureAnalytics(saved.includes(id) ? 'offer_unsaved' : 'offer_saved', { offer_id: id, category: deal.category });
    setSaved(current => current.includes(id) ? current.filter(item => item !== id) : [...current, id]);
  };
  const openSearch = (nextCategory = 'All') => { setCategory(nextCategory); setQuery(''); go('search'); };
  return <div className="app-layout">
    {menuOpen && <button className="mobile-scrim" aria-label="Close account menu" onClick={() => setMenuOpen(false)} />}
    <aside className={`sidebar ${menuOpen ? 'sidebar-open' : ''}`} aria-label="Main menu">
      <div className="sidebar-top"><span className="brand">kouponly</span><button className="sidebar-close" aria-label="Close account menu" onClick={() => setMenuOpen(false)}><X size={21}/></button></div>
      <div className="sidebar-intro"><strong>Your Kouponly</strong><span>{saved.length} saved {saved.length === 1 ? 'place' : 'places'}</span></div>
      <nav className="sidebar-nav">{navigation.map(({ label, view: destination, Icon }) => <button key={destination} aria-current={view === destination ? 'page' : undefined} className={`nav-link ${view === destination ? 'nav-link-active' : ''}`} onClick={() => go(destination)}><Icon size={18}/><span>{label}</span>{view === destination && <ChevronRight size={15}/>}</button>)}</nav>
      <div className="sidebar-bottom"><button onClick={() => go('account')}><Settings size={17}/> Settings</button><p>Find more. Spend less.</p></div>
    </aside>

    <main className="main-content">
      <header className="topbar"><button className="menu-button" aria-label="Open account menu" onClick={() => setMenuOpen(true)}><Menu size={22}/></button><button className="topbar-brand" onClick={() => go('home')}>kouponly</button><button className="topbar-saved" aria-label="View saved offers" onClick={() => go('saved')}><Bookmark size={21}/></button></header>
      {selected ? <DealDetails deal={selected} saved={saved.includes(selected.id)} onBack={() => setSelected(null)} onSave={() => toggleSaved(selected.id)} /> : <>
        {view === 'home' && <>
          <div className="page-heading"><h1>Save on what you love.</h1><p>Good offers from places around you.</p></div>
          <div className="pillars" aria-label="Kouponly areas"><div className="pillar pillar-active">Save</div><div className="pillar"><span>Go out</span><small>Coming soon</small></div><div className="pillar"><span>Grow</span><small>Coming soon</small></div></div>
          <button className="search-link" onClick={() => openSearch()}><Search size={19}/><span>Search offers or places</span><ChevronRight size={18}/></button>
          <button className="featured" aria-label={`View ${deals[0].name} offer`} onClick={() => setSelected(deals[0])}><img src={deals[0].image} alt=""/><span className="featured-copy"><small>Featured offer</small><strong>{deals[0].name}</strong><span>{deals[0].offer}</span><b>{deals[0].saving}<ChevronRight size={19}/></b></span></button>
          <SectionTitle title="Browse by category" action="See all" onAction={() => openSearch()}/>
          <div className="category-grid">{categories.map(item => <button key={item.name} onClick={() => openSearch(item.name)}><img src={item.image} alt=""/><span>{item.name}</span></button>)}</div>
          <SectionTitle title="Offers nearby" action="Map" onAction={() => go('map')}/>
          <DealList items={deals.slice(1, 9)} saved={saved} onOpen={setSelected} onSave={toggleSaved}/>
          <button className="text-action" onClick={() => openSearch()}>View all offers <ChevronRight size={18}/></button>
        </>}
        {view === 'search' && <>
          <div className="page-heading"><h1>Explore offers</h1><p>Find a saving worth keeping.</p></div>
          <label className="search-field"><Search size={19}/><input autoFocus value={query} onChange={event => setQuery(event.target.value)} placeholder="Search places or offers" aria-label="Search offers"/>{query && <button aria-label="Clear search" onClick={() => setQuery('')}><X size={17}/></button>}</label>
          <div className="filter-row">{['All', ...categories.map(item => item.name)].map(item => <button key={item} aria-pressed={category === item} onClick={() => setCategory(item)}>{item}</button>)}</div>
          <SectionTitle title={query ? 'Search results' : 'All offers'} action={String(results.length)}/>
          {results.length ? <DealList items={results} saved={saved} onOpen={setSelected} onSave={toggleSaved}/> : <Empty title="No offers found" body="Try another search or category."/>}
        </>}
        {view === 'saved' && <>
          <div className="page-heading"><h1>Saved</h1><p>Keep the offers you want to use.</p></div>
          <SectionTitle title="Your places" action={String(savedDeals.length)}/>
          {savedDeals.length ? <DealList items={savedDeals} saved={saved} onOpen={setSelected} onSave={toggleSaved}/> : <Empty title="No saved places yet" body="Explore offers and save the places you like." action={() => openSearch()}/>}
        </>}
        {view === 'map' && <>
          <div className="page-heading"><h1>Offers nearby</h1><p>Explore savings around Kochi.</p></div>
          <div className="map-panel"><img src="/kochi-map-bg.png" alt="Illustrated map of Kochi"/><div className="map-caption"><MapPin size={19}/> Kochi · {deals.length} offers</div></div>
          <SectionTitle title="Places around you" action={String(deals.length)}/>
          <DealList items={deals} saved={saved} onOpen={setSelected} onSave={toggleSaved}/>
        </>}
        {view === 'account' && <>
          <div className="page-heading"><h1>My account</h1><p>Your savings, in one place.</p></div>
          <div className="account-summary"><div><strong>{saved.length}</strong><span>Saved places</span></div><div><strong>Save</strong><span>Available now</span></div></div>
          <div className="account-links"><button onClick={() => go('saved')}>Saved places <ChevronRight size={17}/></button><button onClick={() => openSearch()}>Explore offers <ChevronRight size={17}/></button><a href="mailto:info@kouponly.in">Help & support <ChevronRight size={17}/></a></div>
        </>}
      </>}
    </main>
  </div>;
}

function SectionTitle({ title, action, onAction }: { title: string; action: string; onAction?: () => void }) { return <div className="section-title"><h2>{title}</h2>{onAction ? <button onClick={onAction}>{action}</button> : <span>{action}</span>}</div>; }
function Empty({ title, body, action }: { title: string; body: string; action?: () => void }) { return <div className="empty"><Bookmark size={24}/><h2>{title}</h2><p>{body}</p>{action && <button onClick={action}>Explore offers <ChevronRight size={17}/></button>}</div>; }
function DealList({ items, saved, onOpen, onSave }: { items: Deal[]; saved: number[]; onOpen: (deal: Deal) => void; onSave: (id: number) => void }) { return <div className="deal-list">{items.map(deal => <article className="deal-row" key={deal.id}><button className="deal-main" onClick={() => onOpen(deal)}><img src={deal.image} alt=""/><span className="deal-copy"><strong>{deal.name}</strong><span>{deal.offer}</span><small><MapPin size={13}/>{deal.place}<b>{deal.saving}</b></small></span></button><button className="save-button" aria-label={saved.includes(deal.id) ? `Remove ${deal.name} from saved` : `Save ${deal.name}`} aria-pressed={saved.includes(deal.id)} onClick={() => onSave(deal.id)}><Heart size={19} fill={saved.includes(deal.id) ? 'currentColor' : 'none'}/></button></article>)}</div>; }
function DealDetails({ deal, saved, onBack, onSave }: { deal: Deal; saved: boolean; onBack: () => void; onSave: () => void }) { return <div className="details"><button className="back-link" onClick={onBack}><ArrowLeft size={18}/> Back</button><img className="detail-image" src={deal.image} alt=""/><div className="detail-heading"><div><small>{deal.category}</small><h1>{deal.name}</h1><p><MapPin size={15}/>{deal.place} · {deal.distance}</p></div><button aria-label={saved ? 'Remove from saved' : 'Save offer'} onClick={onSave}><Heart size={20} fill={saved ? 'currentColor' : 'none'}/></button></div><div className="offer-detail"><div><small>Available offer</small><h2>{deal.offer}</h2><strong>{deal.saving}</strong></div><Check size={20}/></div><p className="detail-description">{deal.description}</p><a className="directions" href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${deal.name}, ${deal.place}, Kerala`)}`} target="_blank" rel="noopener noreferrer">Get directions <ChevronRight size={17}/></a></div>; }
