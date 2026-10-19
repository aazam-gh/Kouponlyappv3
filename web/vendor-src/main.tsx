import React from 'react'
import ReactDOM from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { VendorPanelApp } from '@/vendor-panel'
import '@/styles.css'

const queryClient = new QueryClient()
const rootElement = document.getElementById('root')

if (!rootElement) throw new Error('Vendor Panel root element is missing')

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <VendorPanelApp queryClient={queryClient} />
    </QueryClientProvider>
  </React.StrictMode>,
)
