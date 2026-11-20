// Default styles of the wallet modal; the app's own rules override them.
// Kept in a module of its own so the stylesheet (and the web font it
// imports) loads with the modal instead of with every page that can
// connect a wallet.
import "@solana/wallet-adapter-react-ui/styles.css";

export {};
