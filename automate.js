// ============================================================
// LATTE PAWS — FULL AUTOMATION SCRIPT
// Creates all products on Printful via API + updates website
// 
// Usage: node automate.js <STORE_ID>
// Example: node automate.js 12345678
// ============================================================

const PRINTFUL_API_KEY = "oy42bJfc62iB1BRfW864F1lKqEAPjmNAIUw27dEf";
const STORE_ID = process.argv[2];
const DESIGN_BASE_URL = "https://wesley-hkt.github.io/lattepaws/products";
const RETAIL_PRICE = 19.99;

if (!STORE_ID) {
    console.error("❌ Usage: node automate.js <STORE_ID>");
    console.error("   Get your Store ID from Printful Dashboard → Stores");
    process.exit(1);
}

const HEADERS = {
    "Authorization": `Bearer ${PRINTFUL_API_KEY}`,
    "Content-Type": "application/json",
    "X-PF-Store-Id": STORE_ID
};

// ===== PRODUCT CATALOG =====
const products = [
    {
        name: "Spooky Pups Halloween Bandana",
        design: "halloween-bandana.svg",
        price: 19.99,
        description: "Cute Halloween dog bandana with spooky pups, ghosts, and pumpkins. Perfect for Halloween photos!"
    },
    // Add more products here as you design them
];

// ===== CREATE PRODUCT =====
async function createProduct(product) {
    const designUrl = `${DESIGN_BASE_URL}/${product.design}`;
    
    const body = {
        sync_product: {
            name: product.name,
            thumbnail: designUrl,
            is_ignored: false
        },
        sync_variants: [
            { retail_price: product.price, variant_id: 16031, files: [{ url: designUrl, filename: product.design }] }, // S
            { retail_price: product.price, variant_id: 16032, files: [{ url: designUrl, filename: product.design }] }, // M
            { retail_price: product.price, variant_id: 16033, files: [{ url: designUrl, filename: product.design }] }  // L
        ]
    };
    
    const response = await fetch("https://api.printful.com/store/products", {
        method: "POST",
        headers: HEADERS,
        body: JSON.stringify(body)
    });
    
    return await response.json();
}

// ===== MAIN =====
async function main() {
    console.log(`\n🐾 Latte Paws Automation`);
    console.log(`   Store ID: ${STORE_ID}`);
    console.log(`   Products to create: ${products.length}\n`);
    
    const results = [];
    
    for (const product of products) {
        console.log(`📦 Creating: ${product.name}...`);
        const result = await createProduct(product);
        
        if (result.code === 200) {
            console.log(`   ✅ Success! Product ID: ${result.result.sync_product.id}`);
            results.push({
                name: product.name,
                printfulId: result.result.sync_product.id,
                variants: result.result.sync_variants.map(v => ({
                    id: v.id,
                    variantId: v.variant_id,
                    size: v.name
                })),
                price: product.price,
                design: product.design
            });
        } else {
            console.log(`   ❌ Failed: ${result.error?.message || JSON.stringify(result)}`);
        }
    }
    
    // Save results
    const fs = await import('fs');
    fs.writeFileSync('printful-products.json', JSON.stringify(results, null, 2));
    console.log(`\n✅ Done! ${results.length}/${products.length} products created`);
    console.log(`   Saved to: printful-products.json\n`);
    console.log(`   Next: Run 'node update-website.js' to sync products to your site\n`);
}

main().catch(console.error);