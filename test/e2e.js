const { expect } = require("chai");

require('dotenv').config();
const { MAX_TOKENS, REVEAL_TIMESTAMP, IPFS_BASE_PATH, MINT_PRICE, TOTAL_RESERVE, IPFS_HIDDEN, PROVENANCE_HASH } = process.env;

async function getMintId(tx) {
    return parseInt((await tx.wait()).events[0].args[2].toString());
}

describe("Token contract", function () {

    let Contract;
    let contract;
    let tokenContract;
    let middleContract;

    let owner;
    let addrs;
    let newAccount;

    let mintId=null;

    before(async function () {
        tokenContract = await (await ethers.getContractFactory("MockToken")).deploy();

        Contract = await ethers.getContractFactory("LuchaMaskCustom");
        [owner, ...addrs] = await ethers.getSigners();
        contract = await Contract.deploy(
            tokenContract.address,
            MAX_TOKENS,
            REVEAL_TIMESTAMP,
            TOTAL_RESERVE,
            `ipfs://${IPFS_HIDDEN}`
        );

        middleContract = await (await ethers.getContractFactory("MiddleContract")).deploy(contract.address, tokenContract.address);
    });

    describe("Owner checks:", function () {

        it("Account owns contract", async function () {
            expect(await contract.owner()).to.equal(owner.address);
        });

        it("Check TVK balance", async function () {
            let tvkBalance = (await tokenContract.balanceOf(owner.address)).toString();
            expect(tvkBalance).to.equal("1000000000000000000000000000000");
        });

        it("Account owns contract", async function () {
            expect(await contract.owner()).to.equal(owner.address);
        });

        it(`Provenance hash setup:`, async function () {
            await contract.setProvenanceHash(PROVENANCE_HASH).catch((e) => {
                throw (e);
            });
            expect(await contract.MASKS_PROVENANCE()).to.equal("f94378c0724a27f61d7f49363b7d693aae195ab4a2e106f932f9e1194e258e76");
        });

        it(`Resetting provenance should fail:`, async function () {
            await contract.setProvenanceHash({
            }).catch((e) => {
                expect(e.message).to.include("Provenance can not be changed after the sale is started.");
            });
        });
    });

    describe("Minting flow:", function () {
        it(`Should throw error when fetching url using "tokenURI" for non minted tokens.`, async function () {
            await contract.tokenURI(1).catch((e) => {
                expect(e.message).to.include(`URI query for nonexistent token`);
            })
        });

        it("Mint mask (without balance)", async function () {
            newAccount = waffle.provider.createEmptyWallet();

            const balance = await waffle.provider.getBalance(newAccount.address);
            expect(balance).to.equal(0);

            await contract.connect(newAccount).mintMask({
                value: ethers.BigNumber.from(MINT_PRICE)
            }).catch((e) => {
                expect(e.message).to.include('sender doesn\'t have enough funds');
            });
        });

        it("Mint mask (with balance)", async function () {
            await owner.sendTransaction({
                to: newAccount.address,
                value: ethers.BigNumber.from("500000000000000000")
            })
            const newBalance = await waffle.provider.getBalance(newAccount.address);
            expect(newBalance).to.equal(ethers.BigNumber.from("500000000000000000"));

            mintId= await getMintId(await contract.connect(newAccount).mintMask({
                value: ethers.BigNumber.from(MINT_PRICE)
            }).catch((e) => {
                throw(e);
            }));
        });

        it("Second mint on guest should fail.", async function () {
            await contract.connect(newAccount).mintMask({
                value: ethers.BigNumber.from(MINT_PRICE)
            }).catch((e) => {
                expect(e.message).to.include('you dont fulfill the requirements to mint luchamasks');
            });
        });

        it("Make user member and then mint should work.", async function () {
            await tokenContract.transfer(newAccount.address, ethers.BigNumber.from("5000000000000000000000")).catch((e) => {
                throw(e);
            });
            expect(await tokenContract.balanceOf(newAccount.address)).to.equal(ethers.BigNumber.from("5000000000000000000000"));

            await contract.connect(newAccount).mintMask({
                value: ethers.BigNumber.from(MINT_PRICE)
            }).catch((e) => {
                throw(e);
            });
        });

        it("Third mint should pass", async function () {
            await contract.connect(newAccount).mintMask({
                value: ethers.BigNumber.from(MINT_PRICE)
            }).catch((e) => {
                throw(e);
            });
        })

        it("Fourth mint for member should fail.", async function () {
            await contract.connect(newAccount).mintMask({
                value: ethers.BigNumber.from(MINT_PRICE)
            }).catch((e) => {
                expect(e.message).to.include('you dont fulfill the requirements to mint luchamasks');
            });
        })

        it("Should not generate link!", async function () {
            expect(await contract.tokenURI(mintId)).to.include(`ipfs://${IPFS_HIDDEN}`);
        });

        // ??? https://emn178.github.io/online-tools/sha256.html
        it("Should generate link for items minted.", function () {
            return new Promise(function (resolve) {
                setTimeout(async function () {
                    expect(await contract.tokenURI(mintId)).to.include(`ipfs://${IPFS_HIDDEN}`);
                    await contract.setBaseURI(`ipfs://${IPFS_BASE_PATH}/`);
                    expect(await contract.tokenURI(mintId)).to.include(`ipfs://${IPFS_BASE_PATH}/${mintId}.json`);
                    resolve();
                }, 5000);
            });

        });
    });

    describe("Reservation and middle contract", function () {
        it("Calling mint from middle contract should fail.", async function () {
            await middleContract.getTVKMockTokens();

            await middleContract.mintTokensFromContract({
                value: ethers.BigNumber.from(MINT_PRICE)
            }).catch((e) => {
                expect(e.message).to.include('we get an error executing the mintMask method from the middle contract');
            });
        });

        it("Reserve 51 should fail due to transaction limit.", async function () {
            await contract.reserveTokensToOwner(51).catch((e) => {
                expect(e.message).to.include('this tx will ran out of gas');
            });
        });

        it("Reserve 50 should work.", async function () {
            await contract.reserveTokensToOwner(50).catch((e) => {
                throw(e);
            });
        });

        it("Reserve 21 should fail due to high limit.", async function () {
            await contract.reserveTokensToOwner(21).catch((e) => {
                expect(e.message).to.include('you cannot reserved more tokens than the maxAmountTokensReserved');
            });
        });

        it("Reserved item count should be 50 and canReserved should not be false.", async function () {
            expect(await contract.reservedTokens()).to.equal(ethers.BigNumber.from("50"));
            expect(await contract.canReserved()).to.equal(true);
        });
    })
});