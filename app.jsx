import { SignIn, SignedIn, SignedOut } from '@clerk/clerk-react'

function App() {
  return (
    <Routes>
      <Route path="/sign-in" element={<SignIn />} />
      <Route path="/dashboard" element={
        <>
          <SignedIn><Dashboard /></SignedIn>
          <SignedOut><Navigate to="/sign-in" /></SignedOut>
        </>
      } />
    </Routes>
  )
}
```

### 3. `.env` — Your key
```
VITE_CLERK_PUBLISHABLE_KEY=pk_test_xxx