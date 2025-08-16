const admin = require('firebase-admin');
const { Storage } = require('@google-cloud/storage');
const { GoogleAuth } = require('google-auth-library');

/**
 * Google Wallet API Helper
 * Zajišťuje autentizaci a komunikaci s Google Wallet API
 */

class GoogleWalletHelper {
  constructor() {
    this.auth = null;
    this.storage = new Storage();
    this.bucketName = 'vernostni-certificates';
    this.credentialsPath = 'firebase-credentials/vernostkarty-8dfab1a54234.json';
    this.issuerId = '3388000000022981331';
    this.baseUrl = 'https://walletobjects.googleapis.com/walletobjects/v1';
    // Service account, který má práva k Issuer ID a bude podepisovat JWT přes IAM
    this.signerServiceAccountEmail = 'vernostkarty@vernostkarty.iam.gserviceaccount.com';
  }

  /**
   * Inicializuje Google Auth s service account credentials
   */
  async initializeAuth() {
    try {
      // Klíč už nepotřebujeme – budeme používat ADC + IAM signJwt
      this.auth = new GoogleAuth();
      console.log('✅ GoogleAuth (ADC) initialized');
      return true;
    } catch (error) {
      console.error('❌ Failed to initialize GoogleAuth (ADC):', error);
      throw error;
    }
  }

  /**
   * Získá access token pro Google API pomocí JWT
   */
  async getAccessToken() {
    if (!this.auth) {
      await this.initializeAuth();
    }

    try {
      // 1) Vytvoříme OAuth JWT assertion payload pro Wallet API scope
      const now = Math.floor(Date.now() / 1000);
      const assertionPayload = {
        iss: this.signerServiceAccountEmail,
        scope: 'https://www.googleapis.com/auth/wallet_object.issuer',
        aud: 'https://oauth2.googleapis.com/token',
        exp: now + 3600,
        iat: now
      };

      // 2) Necháme IAMCredentials podepsat payload jako JWT
      const iamAuth = new GoogleAuth({ scopes: ['https://www.googleapis.com/auth/iam'] });
      const iamClient = await iamAuth.getClient();
      const name = `projects/-/serviceAccounts/${this.signerServiceAccountEmail}`;
      const signUrl = `https://iamcredentials.googleapis.com/v1/${encodeURIComponent(name)}:signJwt`;
      const signRes = await iamClient.request({
        url: signUrl,
        method: 'POST',
        data: { payload: JSON.stringify(assertionPayload) }
      });
      const signedAssertion = signRes.data && signRes.data.signedJwt;
      if (!signedAssertion) {
        throw new Error('IAM signJwt for access token failed');
      }

      // 3) Výměna JWT assertion za access token
      const response = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
          assertion: signedAssertion
        })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(`OAuth2 error: ${data.error_description || data.error || 'unknown'}`);
      }
      return data.access_token;
    } catch (error) {
      console.error('❌ Failed to get access token via IAM signJwt:', error);
      throw error;
    }
  }

  /**
   * Vytvoří novou loyalty class v Google Wallet
   */
  async createLoyaltyClass(classData) {
    try {
      const accessToken = await this.getAccessToken();
      const fullClassId = `${this.issuerId}.${classData.classId}`;

      // Struktura loyalty class podle Google Wallet API
      const loyaltyClass = {
        id: fullClassId,
        issuerName: classData.issuerName,
        programName: classData.programName,
        programLogo: classData.programLogo ? {
          sourceUri: {
            uri: classData.programLogo
          },
          contentDescription: {
            defaultValue: {
              language: 'cs',
              value: 'Logo programu'
            }
          }
        } : undefined,
        hexBackgroundColor: classData.hexBackgroundColor || '#4285f4',
        localizedIssuerName: {
          defaultValue: {
            language: 'cs',
            value: classData.localizedIssuerName || classData.issuerName
          }
        },
        localizedProgramName: {
          defaultValue: {
            language: 'cs',
            value: classData.localizedProgramName || classData.programName
          }
        },
        reviewStatus: 'UNDER_REVIEW',
        allowMultipleUsersPerObject: true
      };

      // Přidání popisu pokud existuje
      if (classData.programDescription) {
        loyaltyClass.programDescription = {
          defaultValue: {
            language: 'cs',
            value: classData.programDescription
          }
        };
      }

      // Přidání rewards tier pokud existuje
      if (classData.rewardsTier) {
        loyaltyClass.rewardsTier = classData.rewardsTier;
      }

      console.log('🚀 Creating Google Wallet loyalty class:', fullClassId);

      const response = await fetch(`${this.baseUrl}/loyaltyClass`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(loyaltyClass)
      });

      const responseData = await response.json();

      if (!response.ok) {
        console.error('❌ Google API Error:', responseData);
        throw new Error(`Google API Error: ${responseData.error?.message || 'Unknown error'}`);
      }

      console.log('✅ Loyalty class created successfully:', fullClassId);
      return {
        success: true,
        classId: fullClassId,
        data: responseData
      };

    } catch (error) {
      console.error('❌ Error creating loyalty class:', error);
      throw error;
    }
  }

  /**
   * Aktualizuje existující loyalty class
   */
  async updateLoyaltyClass(classId, classData) {
    try {
      const accessToken = await this.getAccessToken();
      const fullClassId = classId.includes('.') ? classId : `${this.issuerId}.${classId}`;

      // Podobná struktura jako při vytváření
      const loyaltyClass = {
        id: fullClassId,
        issuerName: classData.issuerName,
        programName: classData.programName,
        programLogo: classData.programLogo ? {
          sourceUri: {
            uri: classData.programLogo
          }
        } : undefined,
        hexBackgroundColor: classData.hexBackgroundColor || '#4285f4',
        localizedIssuerName: {
          defaultValue: {
            language: 'cs',
            value: classData.localizedIssuerName || classData.issuerName
          }
        },
        localizedProgramName: {
          defaultValue: {
            language: 'cs',
            value: classData.localizedProgramName || classData.programName
          }
        }
      };

      console.log('🔄 Updating Google Wallet loyalty class:', fullClassId);

      const response = await fetch(`${this.baseUrl}/loyaltyClass/${fullClassId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(loyaltyClass)
      });

      const responseData = await response.json();

      if (!response.ok) {
        console.error('❌ Google API Error:', responseData);
        throw new Error(`Google API Error: ${responseData.error?.message || 'Unknown error'}`);
      }

      console.log('✅ Loyalty class updated successfully:', fullClassId);
      return {
        success: true,
        classId: fullClassId,
        data: responseData
      };

    } catch (error) {
      console.error('❌ Error updating loyalty class:', error);
      throw error;
    }
  }

  /**
   * Získá informace o loyalty class
   */
  async getLoyaltyClass(classId) {
    try {
      const accessToken = await this.getAccessToken();
      const fullClassId = classId.includes('.') ? classId : `${this.issuerId}.${classId}`;

      const response = await fetch(`${this.baseUrl}/loyaltyClass/${fullClassId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      });

      if (!response.ok) {
        if (response.status === 404) {
          return { exists: false };
        }
        const errorData = await response.json();
        throw new Error(`Google API Error: ${errorData.error?.message || 'Unknown error'}`);
      }

      const data = await response.json();
      return {
        exists: true,
        data: data
      };

    } catch (error) {
      console.error('❌ Error getting loyalty class:', error);
      throw error;
    }
  }

  /**
   * Vytvoří nový loyalty object (konkrétní pass) v Google Wallet
   * @param {Object} objectData
   * @param {string} objectData.classId - Wix fullId nebo suffix (doplní se issuerId pokud chybí)
   * @param {string} [objectData.objectSuffix] - Volitelný suffix Object ID; pokud není, odvodí se z e-mailu
   * @param {string} [objectData.givenName]
   * @param {string} [objectData.familyName]
   * @param {string} [objectData.email]
   * @param {string} [objectData.phone]
   * @param {string|number} [objectData.points]
   * @param {string|number} [objectData.stampCount]
   * @param {string} [objectData.barcodeValue]
   */
  async createLoyaltyObject(objectData) {
    try {
      const accessToken = await this.getAccessToken();

      // classId může být fullId (s tečkou) nebo suffix
      const fullClassId = objectData.classId.includes('.')
        ? objectData.classId
        : `${this.issuerId}.${objectData.classId}`;

      // Stabilní suffix pro objectId (preferujeme e-mail)
      const normalize = (s) => (s || '').toString().toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
      const emailSlug = objectData.email ? normalize(objectData.email) : null;
      const fallbackSuffix = `${normalize(fullClassId.split('.').pop())}-${Date.now()}`;
      const objectSuffix = objectData.objectSuffix || emailSlug || fallbackSuffix;
      const fullObjectId = `${this.issuerId}.${objectSuffix}`;

      // Sestavení loyaltyObject – volitelná pole jen pokud existují
      const loyaltyObject = {
        id: fullObjectId,
        classId: fullClassId,
        state: 'ACTIVE'
      };

      // accountId/accountName
      const accountName = [objectData.givenName || '', objectData.familyName || ''].join(' ').trim();
      if (objectData.email) loyaltyObject.accountId = String(objectData.email);
      if (accountName) loyaltyObject.accountName = accountName;

      // Loyalty points (volitelně)
      const pointsInt = Number.isFinite(Number(objectData.points)) ? parseInt(objectData.points, 10) : null;
      if (!Number.isNaN(pointsInt) && pointsInt !== null) {
        loyaltyObject.loyaltyPoints = {
          label: 'Points',
          balance: { int: pointsInt }
        };
      }

      // Textové moduly – email/telefon
      const textModulesData = [];
      if (objectData.email) textModulesData.push({ header: 'E-mail', body: String(objectData.email) });
      if (objectData.phone) textModulesData.push({ header: 'Telefon', body: String(objectData.phone) });
      if (textModulesData.length) loyaltyObject.textModulesData = textModulesData;

      // Info řádky – jméno/příjmení, razítka
      const infoRows = [];
      const nameColumns = [];
      if (objectData.givenName) nameColumns.push({ label: 'Jméno', value: String(objectData.givenName) });
      if (objectData.familyName) nameColumns.push({ label: 'Příjmení', value: String(objectData.familyName) });
      if (nameColumns.length) infoRows.push({ columns: nameColumns });
      if (Number.isFinite(Number(objectData.stampCount))) {
        infoRows.push({ columns: [{ label: 'Razítka', value: String(objectData.stampCount) }] });
      }
      if (infoRows.length) loyaltyObject.infoModuleData = { labelValueRows: infoRows };

      // Barcode – pokud je k dispozici
      if (objectData.barcodeValue) {
        loyaltyObject.barcode = {
          type: 'QR_CODE',
          value: String(objectData.barcodeValue),
          alternateText: String(objectData.barcodeValue)
        };
      }

      console.log('🚀 Creating Google Wallet loyalty object:', fullObjectId);

      const response = await fetch(`${this.baseUrl}/loyaltyObject`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(loyaltyObject)
      });

      const responseData = await response.json();
      if (!response.ok) {
        console.error('❌ Google API Error:', responseData);
        throw new Error(`Google API Error: ${responseData.error?.message || 'Unknown error'}`);
      }

      console.log('✅ Loyalty object created successfully:', fullObjectId);
      return {
        success: true,
        objectId: fullObjectId,
        classId: fullClassId,
        data: responseData
      };

    } catch (error) {
      console.error('❌ Error creating loyalty object:', error);
      throw error;
    }
  }

  /**
   * Vytvoří "Save to Google Wallet" JWT a vrátí URL
   * @param {string} classId - full nebo suffix (doplní se issuerId)
   * @param {string} objectId - full nebo suffix (doplní se issuerId)
   * @returns {string} saveUrl
   */
  async createSaveLinkJWT(classId, objectId) {
    if (!this.auth) {
      await this.initializeAuth();
    }

    const fullClassId = classId.includes('.') ? classId : `${this.issuerId}.${classId}`;
    const fullObjectId = objectId.includes('.') ? objectId : `${this.issuerId}.${objectId}`;

    // Nepodepisujeme lokálním klíčem – použijeme IAMCredentials signJwt
    const payload = {
      iss: this.signerServiceAccountEmail,
      aud: 'google',
      typ: 'savetoandroidpay',
      payload: {
        loyaltyObjects: [
          {
            id: fullObjectId,
            classId: fullClassId
          }
        ]
      }
    };

    // Autorizace pro IAMCredentials API
    const iamAuth = new GoogleAuth({ scopes: ['https://www.googleapis.com/auth/iam'] });
    const iamClient = await iamAuth.getClient();
    const name = `projects/-/serviceAccounts/${this.signerServiceAccountEmail}`;
    const url = `https://iamcredentials.googleapis.com/v1/${encodeURIComponent(name)}:signJwt`;
    const res = await iamClient.request({
      url,
      method: 'POST',
      data: { payload: JSON.stringify(payload) }
    });

    const signedJwt = res.data && res.data.signedJwt;
    if (!signedJwt) {
      throw new Error('IAM signJwt failed: no signedJwt in response');
    }
    return `https://pay.google.com/gp/v/save/${signedJwt}`;
  }
}

module.exports = GoogleWalletHelper;
