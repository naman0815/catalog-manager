A tool to organize, filter, and create custom collections for [Nuvio](https://github.com/NuvioMedia/NuvioTV)

# Guide
1. Ensure you have catalogs in your AIOStreams config or another add on for catalogs.
2. Open the catalog manager, sync your catalogs using the manifest URL, and create your custom collections. There's a tutorial within the app to help you out.
3. Download the JSON file.
4. In the Nuvio TV app, go to Addons → Manage from phone.
5. Scan the QR code, go to Collections, and click Import. Paste your URL or import the JSON.
6. Save changes and sync to your TV. Done!
⚠️ I have not tested this on mobile so PC is highly recommended.

#Screenshot
<img width="1470" height="956" alt="Screenshot 2026-04-10 at 10 49 26 PM" src="https://github.com/user-attachments/assets/c470c437-6d84-48a8-95e4-f2cba051678c" />


# 🛠️ Developer Setup & Self-Hosting

If you want to run the Catalog Manager locally or host it on your own server (e.g., GitHub Pages, Vercel, or a private VPS), follow these steps:

#### **Prerequisites**
*   **Node.js**: Version 18.x or higher
*   **npm** or **yarn**

#### **1. Clone the Repository**
```bash
git clone https://github.com/your-username/catalog-manager.git
cd catalog-manager
```

#### **2. Install Dependencies**
```bash
npm install
```

#### **3. Local Development**
Start the development server with hot-reload to make changes and test in real-time:
```bash
npm run dev
```
The app will typically be available at `http://localhost:5173`.

#### **4. Build for Production**
To generate a highly optimized static build for hosting:
```bash
npm run build
```
The output will be in the `dist/` folder. You can drop these files into any static web host.

#### **5. Deployment (Optional)**
This project is Vite-based and can be deployed easily to:
*   **Vercel/Netlify**: Just connect your repository; it will auto-detect the build settings.
*   **GitHub Pages**: Use the included `gh-pages` workflow or run `npm run build` and push the `dist` folder to a `gh-pages` branch.

---

> [!TIP]
> **Environment Variables**: This app is designed to be client-side only and doesn't require a backend. All catalog data is processed in your browser and saved to local storage for privacy.
