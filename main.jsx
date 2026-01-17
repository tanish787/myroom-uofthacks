import { ClerkProvider } from '@clerk/clerk-react'

ReactDOM.createRoot(document.getElementById('root')).render(
  <ClerkProvider publishableKey="pk_test_xxx">
    <App />
  </ClerkProvider>
)