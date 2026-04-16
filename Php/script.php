<?php

// Export de livres BookStack en PDF fusionné. 
const CONFIG = [
    'api_url' => 'https://bookstack.nicecotedazur.org/',
    'client_id' => 'VvI2WEJVXbCZN4IF6wqV8N7vEIrUdzev',
    'client_secret' => 'FFe37BJsDHlKQHLNdauPyNlFTi9B2Nwh',
    'format' => 'pdf',
    'location' => './',
    'pagination' => 100,
    'timeout' => 300,
    'dpi' => 300,   
    'compression' => 'prepress',
    'excluded' => ['Hôtel des Polices'],
];

function loadExcludedPages(): array {
    // Charge la liste des pages exclues depuis la config et le fichier optionnel
    $pages = CONFIG['excluded'];
    $file = __DIR__ . '/excluded_pages.txt';
    if (file_exists($file)) {
        $lines = array_filter(array_map('trim', file($file, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES)), 
            fn($l) => $l && $l[0] !== '#');
        $pages = array_merge($pages, $lines);
    }
    return $pages;
}

class Logger {
    // Affiche un message avec un label homogène
    private static function write(string $label, string $msg): void {
        echo "[$label] $msg\n";
    }

    public static function info(string $msg): void { self::write('INFO', $msg); }
    public static function success(string $msg): void { self::write('OK', $msg); }
    public static function error(string $msg): void { self::write('ERREUR', $msg); }
    public static function warning(string $msg): void { self::write('ATTENTION', $msg); }

    public static function title(string $t): void {
        $line = str_repeat('=', strlen($t) + 4);
        echo "\n$line\n  $t  \n$line\n\n";
    }

    public static function section(string $s): void {
        echo "\n--- $s ---\n";
    }
}

class ApiClient {
    private $url;
    private $id;
    private $secret;
    private $timeout;

    public function __construct(string $url, string $id, string $secret, int $timeout = 300) {
        $this->url = rtrim($url, '/');
        $this->id = $id;
        $this->secret = $secret;
        $this->timeout = $timeout;
    }

    public function get(string $endpoint): string {
        // Appel GET simple avec authentification BookStack
        $ctx = stream_context_create(['http' => ['method' => 'GET', 'header' => "Authorization: Token {$this->id}:{$this->secret}", 'timeout' => $this->timeout]]);
        $res = @file_get_contents($this->url . '/' . ltrim($endpoint, '/'), false, $ctx);
        if ($res === false) throw new Exception('Erreur API: ' . (error_get_last()['message'] ?? 'Inconnue'));
        return $res;
    }

    public function getJson(string $endpoint): array {
        // Décodage JSON avec garde-fou
        $decoded = json_decode($this->get($endpoint), true);
        if ($decoded === null) throw new Exception("JSON invalide: $endpoint");
        return $decoded ?? [];
    }

    public function getAllBooks(): array {
        // Pagination côté API pour récupérer tous les livres
        $all = [];
        $offset = 0;
        do {
            $res = $this->getJson('api/books?' . http_build_query(['count' => CONFIG['pagination'], 'offset' => $offset]));
            $all = array_merge($all, $res['data'] ?? []);
            $offset += CONFIG['pagination'];
        } while ($offset < ($res['total'] ?? 0));
        return $all;
    }
}

class PdfExporter {
    private $api;
    private $outDir;
    private $tempDir;

    public function __construct(ApiClient $api, string $outDir) {
        $this->api = $api;
        $this->outDir = $outDir;
    }

    public function export(array $books): void {
        // Télécharge tous les PDFs puis lance la fusion
        $this->tempDir = $this->outDir . '/temp_pdf_' . time();
        if (!mkdir($this->tempDir, 0755, true)) throw new Exception('Impossible de créer le dossier temporaire');
        try {
            $pdfs = $this->downloadAllPdfs($books);
            if (empty($pdfs)) throw new Exception("Aucun PDF n'a pu être téléchargé");
            $this->mergePdfs($pdfs);
        } finally {
            $this->cleanup();
        }
    }

    private function isExcluded(string $name, array $excluded): bool {
        // Exclusion basée sur un match partiel insensible à la casse
        foreach ($excluded as $ex) {
            if (stripos($name, $ex) !== false) {
                Logger::info("'$name' contient '$ex'");
                return true;
            }
        }
        return false;
    }

    private function downloadAllPdfs(array $books): array {
        Logger::section('Téléchargement et restructuration');
        $excluded = loadExcludedPages();
        $excludedCount = 0;
        if ($excluded) {
            Logger::info('' . count($excluded) . ' pages exclues');
            foreach ($excluded as $e) Logger::info("'$e'");
            Logger::info('');
        }
        $pdfs = [];
        $total = count($books);
        $processed = 0;
        foreach ($books as $idx => $book) {
            try {
                $name = $book['name'];
                if ($this->isExcluded($name, $excluded)) {
                    $excludedCount++;
                    Logger::warning("Exclu: '$name'");
                    continue;
                }
                $processed++;
                Logger::info("Livre $processed/$total : $name");

                $pdf = $this->api->get("api/books/{$book['id']}/export/pdf");
                if (!$pdf) {
                    Logger::warning("Impossible de récupérer '$name'");
                    continue;
                }

                $path = $this->tempDir . '/' . str_pad($idx + 1, 3, '0', STR_PAD_LEFT) . '_' . $book['slug'] . '.pdf';
                if (file_put_contents($path, $pdf) === false) {
                    Logger::warning("Impossible de sauvegarder '$name'");
                    continue;
                }
                $pdfs[] = $path;
                unset($pdf);
            } catch (Exception $e) {
                Logger::warning("Erreur: {$book['name']}: " . $e->getMessage());
            }
        }
        Logger::success('Total: ' . count($pdfs) . ' PDFs téléchargés');
        if ($excludedCount > 0) Logger::info('Pages exclues: ' . $excludedCount);
        return $pdfs;
    }

    private function mergePdfs(array $pdfFiles): void {
        Logger::section('Fusion des PDFs');
        $gs = $this->findGhostscript();
        if (!$gs) throw new Exception("Ghostscript non trouvé. Installer: choco install ghostscript");
        $outPath = $this->outDir . '/export_complet.pdf';
        $inputs = implode(' ', array_map('escapeshellarg', $pdfFiles));
        $cmd = "$gs -dBATCH -dNOPAUSE -q -sDEVICE=pdfwrite -dPreserveHalftone=true -dEmbedAllFonts=true -dCompressFonts=true -r" . CONFIG['dpi'] . 'x' . CONFIG['dpi'] . ' -dPDFSETTINGS=/' . CONFIG['compression'] . " -dAutoRotatePages=/All -sOutputFile=" . escapeshellarg($outPath) . ' ' . $inputs;
        Logger::info('Exécution...');
        $output = shell_exec($cmd . ' 2>&1');
        if (!file_exists($outPath) || filesize($outPath) === 0) throw new Exception("Échec: $output");
        
        $mb = round(filesize($outPath) / 1024 / 1024, 2);
        Logger::success('PDF créé avec succès!');
        Logger::info('Fichier: export_complet.pdf');
        Logger::info("Taille: $mb MB | Livres: " . count($pdfFiles) . " | DPI: " . CONFIG['dpi']);
    }

    private function findGhostscript(): ?string {
        // Recherche Ghostscript suivant l'OS
        foreach (['gswin64c', 'gswin32c', 'gs'] as $name) {
            $cmd = strtoupper(substr(PHP_OS, 0, 3)) === 'WIN' ? "where $name" : "which $name";
            $path = trim(shell_exec($cmd . ' 2>&1'));
            if ($path && file_exists($path)) return $path;
        }
        return null;
    }

    private function cleanup(): void {
        if (!is_dir($this->tempDir)) return;
        foreach (glob($this->tempDir . '/*') as $file) {
            if (is_file($file)) @unlink($file);
        }
        @rmdir($this->tempDir);
        Logger::success('Nettoyage: fichiers temporaires supprimés');
    }
}

function validateConfiguration(): void {
    // Quelques validations rapides pour éviter les surprises
    if (!CONFIG['api_url']) throw new Exception("L'URL API n'est pas définie.");
    if (!CONFIG['client_id'] || !CONFIG['client_secret']) throw new Exception("Les identifiants API ne sont pas définis.");
    if (CONFIG['format'] !== 'pdf') throw new Exception("Seul le format 'pdf' est supporté.");
}

function prepareOutputDirectory(): string {
    // Crée le répertoire cible si besoin et vérifie les droits
    $dir = CONFIG['location'];
    if (!is_dir($dir) && !mkdir($dir, 0755, true)) throw new Exception("Impossible de créer '$dir'.");
    $real = realpath($dir);
    if (!$real || !is_writable($real)) throw new Exception("Répertoire '$dir' inaccessible.");
    return $real;
}

try {
    Logger::title("EXPORT BOOKSTACK → PDF");
    
    Logger::section('Configuration');
    validateConfiguration();
    Logger::success('OK');

    Logger::section('Répertoire');
    $outDir = prepareOutputDirectory();
    Logger::success($outDir);

    Logger::section('Connexion API');
    $api = new ApiClient(CONFIG['api_url'], CONFIG['client_id'], CONFIG['client_secret'], CONFIG['timeout']);
    Logger::success('Connecté');

    Logger::section('Récupération des livres');
    $books = $api->getAllBooks();
    if (empty($books)) throw new Exception('Aucun livre trouvé');
    Logger::success('Livres: ' . count($books));

    Logger::section('Démarrage export');
    (new PdfExporter($api, $outDir))->export($books);

    Logger::title('✓ EXPORT TERMINÉ!');
    Logger::info('');
    Logger::info('📊 Stats finales:');
    Logger::info('  • Résolution: ' . CONFIG['dpi'] . ' DPI');
    Logger::info('  • Compression: ' . CONFIG['compression']);
    Logger::info('  • Source: PDF direct depuis BookStack');
    Logger::info('  • Fusion: Ghostscript');
    Logger::info('');
} catch (Exception $e) {
    Logger::error($e->getMessage());
    exit(1);
}

