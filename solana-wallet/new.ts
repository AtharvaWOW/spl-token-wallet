import {
    Connection,
    PublicKey,
    clusterApiUrl,
    Keypair,
    Transaction,
    sendAndConfirmTransaction,
  } from '@solana/web3.js';
  import {
    getAssociatedTokenAddress,
    createAssociatedTokenAccountInstruction,
    createMint,
    getAccount,
    createTransferInstruction,
    mintTo,
    TOKEN_PROGRAM_ID,
  } from '@solana/spl-token';
  
  // Create a connection to the devnet cluster
  const connection = new Connection(clusterApiUrl('devnet'), 'confirmed');
  
  // Generate a new keypair for the sender
  const sender = Keypair.generate();
  const recipientPublicKeyString = '9dGRXbfn5EwWXGWKnBiVD9W9BQLh2MGJxTd92jwpdXHu'; // Recipient's public key (base58 encoded string)
  
  // Create PublicKey objects for the recipient
  const recipientPublicKey: PublicKey = new PublicKey(recipientPublicKeyString);
  
  async function createTokenMint(): Promise<string> {
    // Generate a new keypair for the token mint authority
    const mintAuthority: Keypair = Keypair.generate();
  
    // Airdrop SOL to the mint authority to cover transaction fees
    const airdropSignature = await connection.requestAirdrop(
      mintAuthority.publicKey,
      1e9 // 1 SOL in lamports
    );
  
    // Confirm the airdrop transaction
    await connection.confirmTransaction(airdropSignature);
  
    // Create a new token
    const tokenMintAddress = await createMint(
      connection,
      sender,                  // Payer of the transaction fee
      mintAuthority.publicKey, // Mint authority
      null,                    // Freeze authority (optional)
      9                        // Number of decimals
    );
  
    // Get the token mint address
    const tokenMintAddressString: string = tokenMintAddress.toBase58();
    console.log('Token Mint Address:', tokenMintAddressString);
  
    // Get the sender's associated token account address
    const senderTokenAccount = await getAssociatedTokenAddress(
      tokenMintAddress,
      sender.publicKey
    );
  
    // Create the sender's associated token account if it doesn't exist
    const senderAccountInfo = await connection.getAccountInfo(senderTokenAccount);
    if (!senderAccountInfo) {
      const transaction = new Transaction().add(
        createAssociatedTokenAccountInstruction(
          sender.publicKey,
          senderTokenAccount,
          sender.publicKey,
          tokenMintAddress
        )
      );
  
      await sendAndConfirmTransaction(connection, transaction, [sender]);
    }
  
    // Mint some tokens to the sender's associated token account
    await mintTo(
      connection,
      sender,
      tokenMintAddress,
      senderTokenAccount,
      mintAuthority,
      1000000000 // 1 token with 9 decimal places
    );
  
    return tokenMintAddressString;
  }
  
  async function transferTokens(tokenMintAddressString: string): Promise<void> {
    try {
      const tokenMintAddress = new PublicKey(tokenMintAddressString);
  
      // Get the sender's token account
      const senderTokenAccount = await getAssociatedTokenAddress(
        tokenMintAddress,
        sender.publicKey
      );
  
      // Check if sender has a token account
      const senderAccountInfo = await getAccount(connection, senderTokenAccount);
  
      // Get the recipient's token account, or create one if it doesn't exist
      const recipientTokenAccount = await getAssociatedTokenAddress(
        tokenMintAddress,
        recipientPublicKey
      );
  
      const recipientAccountInfo = await connection.getAccountInfo(recipientTokenAccount);
      if (!recipientAccountInfo) {
        const transaction = new Transaction().add(
          createAssociatedTokenAccountInstruction(
            sender.publicKey,
            recipientTokenAccount,
            recipientPublicKey,
            tokenMintAddress
          )
        );
  
        await sendAndConfirmTransaction(connection, transaction, [sender]);
      }
  
      // Create the transaction
      const transaction = new Transaction().add(
        createTransferInstruction(
          senderTokenAccount,
          recipientTokenAccount,
          sender.publicKey,
          1,  // Amount to transfer (adjust as needed)
          []
        )
      );
  
      // Sign and send the transaction
      const signature = await sendAndConfirmTransaction(
        connection,
        transaction,
        [sender]
      );
  
      console.log('Transaction successful with signature:', signature);
    } catch (error) {
      console.error('Error transferring tokens:', error);
    }
  }
  
  (async () => {
    // Create a new token mint
    const tokenMintAddressString = await createTokenMint();
  
    // Transfer tokens
    await transferTokens(tokenMintAddressString);
  })();
  